import type { CollectionConfig } from 'payload'

export const PostTranslations: CollectionConfig = {
  slug: 'post-translations',
  admin: {
    useAsTitle: 'translatedTitle',
  },
  fields: [
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'posts',
      required: true,
    },
    {
      name: 'category',
      type: 'text',
      required: false,
      unique: false,
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: false,
      unique: false,
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
      name: 'translatedTitle',
      type: 'text',
      required: true,
    },
    {
      name: 'translatedExcerpt',
      type: 'textarea',
    },
    {
      name: 'translatedContent',
      type: 'textarea',
      required: true,
    },
    {
      name: 'document',
      type: 'tsvector' as any,
      required: false,
      admin: {
        hidden: true,
        readOnly: true,
        description: 'This field is automatically generated and not editable.',
      },
    },
  ],
  hooks: {},
  access: {
    read: () => true,
  },
}
