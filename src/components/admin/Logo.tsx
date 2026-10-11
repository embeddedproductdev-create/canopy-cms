import React from 'react'

/** Canopy logo (same image as the website favicon) for the admin login / forgot-password screens. */
export default function Logo() {
  return (
    <img
      src="/brand/logo.png"
      alt="Canopy Embedded Labs"
      style={{ display: 'block', width: 160, height: 160, objectFit: 'contain', margin: '0 auto' }}
    />
  )
}
