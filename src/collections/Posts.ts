import type { CollectionConfig, PayloadRequest } from 'payload'
import { Translator } from '@/utils/translator'
import { BlogWriter } from '@/utils/blog-writter'
import { ImageGenerator } from '@/utils/image-generation'

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
      defaultValue: false,
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'publishedDate',
      type: 'date',
      admin: {
        condition: (data) => Boolean(data?.published),
      },
    },
    {
      name: 'meta',
      type: 'group',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'description',
          type: 'textarea',
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data }) => {
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

        console.log('Before change hook triggered for post:', data.coberImage)

        const imageGenerator = new ImageGenerator()

        if (!data.coverImage) {
          const imageBlob = await imageGenerator.generate(data.title)
          const arrayBuffer = await imageBlob.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          const upload = await req.payload.create({
            collection: 'media',
            data: {
              alt: data.title,
            },
            file: {
              data: buffer,
              name: `${data.slug}.jpeg`,
              mimetype: 'image/jpeg',
              size: buffer.length,
            },
          })

          data.coverImage = upload.id
        }
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
          write(doc, req)
        }
      },
    ],
  },
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

      const translatedMetaTitle = await translator.translate(data.meta?.title ?? '', locale)
      const translatedMetaDescription = await translator.translate(
        data.meta?.description ?? '',
        locale,
      )

      if (existing && existing?.docs?.[0]) {
        await req.payload.update({
          collection: 'post-translations',
          id: existing.docs[0].id,
          data: {
            translatedTitle,
            translatedExcerpt,
            translatedContent,
            slug: [category?.slug, data.slug].join('/'),
            translatedMeta: {
              title: translatedMetaTitle,
              description: translatedMetaDescription,
            },
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
            translatedMeta: {
              title: translatedMetaTitle,
              description: translatedMetaDescription,
            },
          },
        })
      }

      console.log(`Post translation for ${locale} completed: ${data.title}`)
    }),
  )
}
