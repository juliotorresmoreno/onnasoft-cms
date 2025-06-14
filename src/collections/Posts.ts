import type { CollectionConfig } from 'payload'
import { Translator } from '@/utils/translator'

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
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (value) return value
            return data?.name
              ?.toLowerCase()
              .trim()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '')
          },
        ],
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
    },
    {
      name: 'content',
      type: 'richText',
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
    afterChange: [
      async ({ doc, req }) => {
        const translator = new Translator()
        const locales: Locale[] = ['es', 'en', 'fr', 'ja', 'zh']

        await new Promise((resolve) => setTimeout(resolve, 100))

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

            const children = await Promise.all(
              doc.content.root.children?.map(async (child: any) => {
                if (child.type === 'paragraph') {
                  return {
                    ...child,
                    children: await Promise.all(
                      child.children?.map(async (textNode: any) => ({
                        ...textNode,
                        text: await translator.translate(textNode.text, locale),
                      })),
                    ),
                  }
                }
                return child
              }),
            )

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
                  translatedContent: {
                    ...doc.content,
                    root: {
                      ...doc.content.root,
                      children: children,
                    },
                  },
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
                  translatedContent: {
                    ...doc.content,
                    root: {
                      ...doc.content.root,
                      children: children,
                    },
                  },
                  translatedMeta: {
                    title: translatedMetaTitle,
                    description: translatedMetaDescription,
                  },
                },
              })
            }
          }),
        )
      },
    ],
  },
}
