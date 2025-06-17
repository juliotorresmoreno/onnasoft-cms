import { CollectionConfig } from 'payload'

const NewsletterSubscribers: CollectionConfig = {
  slug: 'newsletter_subscribers',
  admin: {
    useAsTitle: 'email',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'locale',
      type: 'text',
      required: false,
    },
    {
      name: 'subscribedAt',
      type: 'date',
      defaultValue: () => new Date(),
      admin: {
        readOnly: true,
      },
    },
  ],
}

export default NewsletterSubscribers
