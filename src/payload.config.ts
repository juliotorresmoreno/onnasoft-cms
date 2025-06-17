// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { Categories } from './collections/Categories'
import { CategoryTranslations } from './collections/CategoryTranslations'
import { PostTranslations } from './collections/PostTranslations'
import { runFullTextMigration } from './utils/run-fulltext-migration'
import { EmbeddingGenerator } from './utils/embedding-generator'
import { pool } from './utils/db'
import NewsletterSubscribers from './collections/NewsletterSubscribers'

const embeddingGenerators = new EmbeddingGenerator()
const parseVector = (vector: Float32Array<ArrayBufferLike>) => `[${vector.join(', ')}]`

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    Categories,
    CategoryTranslations,
    Posts,
    PostTranslations,
    NewsletterSubscribers,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  plugins: [payloadCloudPlugin()],
  onInit: async () => {
    await runFullTextMigration()
  },
  endpoints: [
    {
      path: '/search',
      method: 'get',
      handler: async (req) => {
        const query = req.query.q as string
        const locale = (req.query.locale as string) || 'en'

        if (!query) {
          return Response.json({ error: 'Missing query parameter' })
        }

        const vector = await embeddingGenerators.generate(query)
        const results = await pool.query(
          `
          SELECT post_translation_id, locale, embedding, updated_at
          FROM search.post_translation_vectors
          WHERE locale = $1
          ORDER BY embedding <-> $2::vector
          LIMIT 5
          `,
          [locale, parseVector(vector)],
        )

        return Response.json(
          await req.payload.find({
            collection: 'post-translations',
            where: {
              id: {
                in: results.rows.map((row) => row.post_translation_id),
              },
            },
            depth: 3,
          }),
        )
      },
    },
  ],
})
