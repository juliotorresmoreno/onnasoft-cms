import type { CollectionConfig, PayloadRequest } from 'payload'
import { Translator } from '@/utils/translator'
import { BlogWriter } from '@/utils/blog-writter'
import { ImageGenerator } from '@/utils/image-generation'
import { EmbeddingGenerator } from '@/utils/embedding-generator'
import { pool } from '@/utils/db'

type Locale = 'es' | 'en' | 'fr' | 'ja' | 'zh'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'regenerate',
      type: 'checkbox',
      label: 'Regenerate Translations',
      defaultValue: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        readOnly: false,
      },
    },
    {
      name: 'coverThumbnail',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        readOnly: false,
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'views',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'likes',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'publishedDate',
      type: 'date',
      defaultValue: () => new Date(),
      admin: {
        condition: (data) => Boolean(data?.published),
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) return

        if (data?.title) {
          const translator = new Translator()
          data.slug =
            data.slug ||
            (await translator.translate(data.title, 'en'))
              .toLowerCase()
              .trim()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '')
        }
        if (!data.coverImage) await generateCoverImages(data, req)
      },
    ],
    beforeChange: [
      async ({ data, req }) => {
        ;(
          req as PayloadRequest & {
            __regenerate?: boolean
          }
        ).__regenerate = data.regenerate ?? false
        data.regenerate = false
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        const regenerate = (
          req as PayloadRequest & {
            __regenerate?: boolean
          }
        ).__regenerate

        if (regenerate) {
          console.log(`Regenerating translations for post: ${doc.title}`)
          write(doc, req).then(async () => {
            await generateEmbeddings(doc, req)
          })
        } else {
          generateEmbeddings(doc, req)
        }
      },
    ],
  },
}

async function generateEmbeddings(
  data: {
    id: string
    title: string
    content: string
  },
  req: PayloadRequest,
) {
  const embeddingGenerator = new EmbeddingGenerator()

  try {
    // 1. Obtener todas las traducciones del post
    const postTranslations = await req.payload.find({
      collection: 'post-translations',
      where: {
        post: {
          equals: data.id,
        },
      },
      limit: 1000, // Aumentamos el límite para obtener todas las traducciones
      depth: 1,
    })

    // 2. Procesar cada traducción
    const results = await Promise.allSettled(
      postTranslations.docs.map(async (translation) => {
        try {
          // Combinar título y contenido para mejor contexto
          const content = [translation.translatedTitle, translation.translatedContent]
            .filter(Boolean)
            .join('\n')
            .replace(/\s+/g, ' ')
            .trim()

          if (!content) {
            console.warn(`Empty content for translation ${translation.id}`)
            return
          }

          // Generar el embedding vectorial
          const translatedEmbedding = await embeddingGenerator.generate(content)

          // Convertir a formato compatible con PostgreSQL (array o vector)
          const embeddingArray = Array.isArray(translatedEmbedding)
            ? translatedEmbedding
            : Object.values(translatedEmbedding)

          // Insertar o actualizar en la base de datos
          await pool.query(
            `INSERT INTO search.post_translation_vectors 
              (post_translation_id, locale, embedding, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (post_translation_id, locale)
             DO UPDATE SET 
               embedding = EXCLUDED.embedding,
               updated_at = NOW()`,
            [translation.id, translation.locale, `[${embeddingArray.join(', ')}]`],
          )

          return { success: true, translationId: translation.id }
        } catch (error) {
          console.error(`Error processing translation ${translation.id}:`, error)
          throw error
        }
      }),
    )

    // 3. Manejar resultados y errores
    const successful = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    console.log(`Embeddings generated for post "${data.title}": 
      ${successful} successful, ${failed} failed`)

    return {
      success: true,
      postId: data.id,
      translationsProcessed: postTranslations.docs.length,
      successful,
      failed,
    }
  } catch (error) {
    console.error('Error in generateEmbeddings:', error)
  }
}

async function write(
  data: Partial<{
    id: number
    title: string
    excerpt?: string
    content?: string
    slug?: string
    category?: { id: string } | string
    meta?: {
      title?: string
      description?: string
    }
  }>,
  req: PayloadRequest,
) {
  const blogWriter = new BlogWriter()
  const translator = new Translator()
  const locales: Locale[] = ['es', 'en', 'fr', 'ja', 'zh']
  await new Promise((resolve) => setTimeout(resolve, 100))
  const categoryId = typeof data.category !== 'object' ? data.category : (data.category?.id ?? '')
  if (!categoryId) {
    console.warn('No category provided for post translation')
    return
  }
  const category = await req.payload.findByID({
    collection: 'categories',
    id: categoryId,
  })

  const content = await blogWriter.write(data.title ?? '', data.excerpt ?? '', data.content || '')
  console.log(`Content generated for post: ${data.title}`)

  await Promise.all(
    locales.map(async (locale) => {
      const existing = await req.payload
        .find({
          collection: 'post-translations',
          where: {
            and: [{ post: { equals: data.id } }, { locale: { equals: locale } }],
          },
        })
        .catch(() => null)

      const translatedTitle = await translator.translate(data.title ?? '', locale)
      const translatedExcerpt = await translator.translate(data.excerpt ?? '', locale)

      const translatedContent = content[locale] || ''

      if (existing && existing?.docs?.[0]) {
        await req.payload.update({
          collection: 'post-translations',
          id: existing.docs[0].id,
          data: {
            translatedTitle,
            translatedExcerpt,
            translatedContent,
            slug: [category?.slug, data.slug].join('/'),
            category: category.slug,
          },
        })
      } else {
        await req.payload.create({
          collection: 'post-translations',
          data: {
            post: data.id!,
            locale,
            translatedTitle,
            translatedExcerpt,
            translatedContent,
            slug: [category?.slug, data.slug].join('/'),
            category: category.slug,
          },
        })
      }

      console.log(`Post translation for ${locale} completed: ${data.title}`)
    }),
  )
}

async function generateCoverImages(
  data: {
    title?: string
    slug?: string
    coverImage?: number
    coverThumbnail?: number
  },
  req: PayloadRequest,
) {
  if (!data.slug || !data.title) return
  const imageGenerator = new ImageGenerator()

  const { image, thumbnail } = await imageGenerator.generate(data.title)
  const [mainBuffer, thumbBuffer] = await Promise.all([
    image.arrayBuffer().then((b) => Buffer.from(b)),
    thumbnail.arrayBuffer().then((b) => Buffer.from(b)),
  ])

  const thumbnailUpload = await req.payload.create({
    collection: 'media',
    data: {
      alt: data.title,
    },
    file: {
      data: thumbBuffer,
      name: `${data.slug}-thumbnail.webp`,
      mimetype: 'image/webp',
      size: thumbBuffer.length,
    },
  })

  const upload = await req.payload.create({
    collection: 'media',
    data: {
      alt: data.title,
      thumbnailURL: thumbnailUpload.url,
    },
    file: {
      data: mainBuffer,
      name: `${data.slug}.webp`,
      mimetype: 'image/webp',
      size: mainBuffer.length,
    },
  })

  data.coverImage = upload.id
  data.coverThumbnail = thumbnailUpload.id

  console.log(`Cover and thumbnail set for post: ${data.title}`)
}
