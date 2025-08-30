import { RenderBuilderContent } from '@builder.io/react'
import { builder } from '@builder.io/react'

builder.init(process.env.NEXT_PUBLIC_BUILDER_API_KEY || '')

export default function BuilderPage({ params }: { params: { slug: string } }) {
  const urlPath = `/${params.slug}`
  return (
    <main className="min-h-screen">
      <RenderBuilderContent model="page" options={{ includeRefs: true }} contentOnly data={{ urlPath }}>
        <div className="mx-auto max-w-3xl p-6">
          <h1 className="text-2xl font-semibold">No Builder content found</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Add a model named "page" and create entry for {urlPath}.</p>
        </div>
      </RenderBuilderContent>
    </main>
  )
}

export const runtime = 'edge'
export const revalidate = 60

