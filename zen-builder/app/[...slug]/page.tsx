import { RenderBuilderContent, builder } from '@builder.io/react'

builder.init(process.env.NEXT_PUBLIC_BUILDER_API_KEY || '')

export default function CatchAll({ params }: { params: { slug?: string[] } }) {
  const urlPath = '/' + (params.slug ? params.slug.join('/') : '')
  return (
    <RenderBuilderContent model="page" options={{ includeRefs: true }} contentOnly data={{ urlPath }}>
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">No Builder content for {urlPath}</h1>
      </div>
    </RenderBuilderContent>
  )
}

export const runtime = 'edge'
export const revalidate = 60

