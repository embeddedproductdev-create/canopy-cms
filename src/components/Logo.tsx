'use client'
import React from 'react'

export const Logo: React.FC = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <img
        src="/my-brand-logo.png"
        alt="Admin Logo"
        style={{ height: '60px', width: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}

export const Icon: React.FC = () => {
  return (
    <img
      src="/my-brand-icon.png"
      alt="Admin Icon"
      style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
    />
  )
}
