(function () {
  'use strict'

  const currentScript =
    document.currentScript ||
    (function () {
      const scripts = document.getElementsByTagName('script')
      return scripts[scripts.length - 1]
    })()

  if (!currentScript || !currentScript.src) {
    console.error('[ChatBotKur] embed.js must be loaded via <script src="...">')
    return
  }

  let scriptUrl
  try {
    scriptUrl = new URL(currentScript.src)
  } catch (e) {
    console.error('[ChatBotKur] could not parse script URL', e)
    return
  }

  const botId = scriptUrl.searchParams.get('botId')

  if (!botId) {
    console.error('[ChatBotKur] botId parameter is required')
    return
  }

  if (window.__chatBotKurLoaded) {
    return
  }
  window.__chatBotKurLoaded = true

  const button = document.createElement('button')
  button.id = 'chatbotkur-toggle-button'
  button.type = 'button'
  button.setAttribute('aria-label', 'Sohbet penceresini aç')

  Object.assign(button.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#7C3AED',
    color: '#ffffff',
    fontSize: '24px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    padding: '0',
    margin: '0',
    outline: 'none',
    fontFamily: 'inherit',
  })

  button.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
    '</svg>'

  button.addEventListener('mouseenter', function () {
    button.style.transform = 'scale(1.05)'
    button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'
  })
  button.addEventListener('mouseleave', function () {
    button.style.transform = 'scale(1)'
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
  })

  button.addEventListener('click', function () {
    alert("Chat penceresi Parça B'de açılacak. botId: " + botId)
  })

  if (document.body) {
    document.body.appendChild(button)
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(button)
    })
  }
})()
