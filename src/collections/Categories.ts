import { Translator } from '@/utils/translator'
import type { CollectionConfig, PayloadRequest } from 'payload'

type Locale = 'es' | 'en' | 'fr' | 'ja' | 'zh'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
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
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'postCount',
      type: 'number',
      defaultValue: 0,
    },
  ],
  hooks: {
    afterRead: [
      async ({ doc, req }) => {
        const posts = await req.payload.find({
          collection: 'posts',
          where: {
            category: {
              equals: doc.id,
            },
          },
          limit: 0,
          depth: 0,
        })

        doc.postCount = posts.totalDocs
        return doc
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        translate(doc, req)
      },
    ],
  },
}

async function translate(
  doc: {
    id: number
    name: string
    description?: string
  },
  req: PayloadRequest,
): Promise<void> {
  const locales: Locale[] = ['es', 'en', 'fr', 'ja', 'zh']
  const translator = new Translator()
  // Espera breve para asegurar persistencia
  await new Promise((resolve) => setTimeout(resolve, 100))

  await Promise.all(
    locales.map(async (locale) => {
      const existing = await req.payload
        .find({
          collection: 'category-translations',
          where: {
            and: [{ category: { equals: doc.id } }, { locale: { equals: locale } }],
          },
        })
        .catch(() => null)

      if (existing?.docs?.[0]) {
        await req.payload.update({
          collection: 'category-translations',
          id: existing.docs[0].id,
          data: {
            translatedName: await translator.translate(doc.name, locale),
            translatedDescription: await translator.translate(doc.description ?? '', locale),
          },
        })
      } else {
        await req.payload.create({
          collection: 'category-translations',
          data: {
            category: doc.id,
            locale,
            translatedName: await translator.translate(doc.name, locale),
            translatedDescription: await translator.translate(doc.description ?? '', locale),
          },
        })
      }
    }),
  )
}
