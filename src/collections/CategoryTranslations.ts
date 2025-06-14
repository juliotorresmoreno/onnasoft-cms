import type { CollectionConfig } from 'payload'

export const CategoryTranslations: CollectionConfig = {
  slug: 'category-translations',
  admin: {
    useAsTitle: 'translatedName',
  },
  fields: [
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
    },
    {
      name: 'locale',
      type: 'select',
      required: true,
      options: [
        { label: 'Español', value: 'es' },
        { label: 'English', value: 'en' },
        { label: 'Français', value: 'fr' },
        { label: '日本語', value: 'ja' },
        { label: '中文', value: 'zh' },
      ],
    },
    {
      name: 'translatedName',
      type: 'text',
      required: true,
    },
    {
      name: 'translatedDescription',
      type: 'textarea',
    },
  ],
}
