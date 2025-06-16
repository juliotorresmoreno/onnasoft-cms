import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: false,
    },
    {
      name: 'position',
      type: 'text',
      required: false,
    },
    {
      name: 'bio',
      type: 'textarea',
      required: false,
    },
    {
      name: 'linkedIn',
      type: 'text',
      required: false,
    },
    {
      name: 'github',
      type: 'text',
      required: false,
    },
    {
      name: 'website',
      type: 'text',
      required: false,
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
