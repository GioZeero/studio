import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="hsl(16 100% 66%)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          width: '100%',
          height: '100%',
          padding: '4px',
        }}
      >
        <path d="M14.4 14.4 9.6 9.6" />
        <path d="M18.657 5.343a2.828 2.828 0 1 1-4 4L13.2 10.8" />
        <path d="m21.5 21.5-2.05-2.05" />
        <path d="M10.8 13.2 9.343 14.657a2.828 2.828 0 1 1-4-4L6.8 9.2" />
        <path d="m2.5 2.5 2.05 2.05" />
      </svg>
    ),
    {
      ...size,
    }
  )
}
