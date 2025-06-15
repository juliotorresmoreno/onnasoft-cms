import type { CollectionConfig } from 'payload'
import { Translator } from '@/utils/translator'
import { BlogWriter } from '@/utils/blog-writter'

type Locale = 'es' | 'en' | 'fr' | 'ja' | 'zh'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
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
    afterChange: [
      async ({ doc, req }) => {
        const blogWriter = new BlogWriter()
        const translator = new Translator()
        const locales: Locale[] = ['es', 'en', 'fr', 'ja', 'zh']

        ;(async function () {
          await new Promise((resolve) => setTimeout(resolve, 100))

          const content = await blogWriter.write(doc.title, doc.excerpt ?? '', doc.content || '')

          await Promise.all(
            locales.map(async (locale) => {
              const existing = await req.payload
                .find({
                  collection: 'post-translations',
                  where: {
                    and: [{ post: { equals: doc.id } }, { locale: { equals: locale } }],
                  },
                })
                .catch(() => null)

              const translatedTitle = await translator.translate(doc.title, locale)
              const translatedExcerpt = await translator.translate(doc.excerpt ?? '', locale)

              console.log(`Translating post "${doc.title}" to ${locale}...`)

              const translatedContent = content[locale] || ''

              const translatedMetaTitle = await translator.translate(doc.meta?.title ?? '', locale)
              const translatedMetaDescription = await translator.translate(
                doc.meta?.description ?? '',
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
                    post: doc.id,
                    locale,
                    translatedTitle,
                    translatedExcerpt,
                    translatedContent,
                    translatedMeta: {
                      title: translatedMetaTitle,
                      description: translatedMetaDescription,
                    },
                  },
                })
              }
            }),
          )
        })()
      },
    ],
  },
}
