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

  const widgetUrl = scriptUrl.origin + '/widget/' + botId

  const chatIconSvg =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
    '</svg>'

  const closeIconSvg =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<line x1="18" y1="6" x2="6" y2="18"/>' +
    '<line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>'

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

  button.innerHTML = chatIconSvg

  const iframeContainer = document.createElement('div')
  iframeContainer.id = 'chatbotkur-iframe-container'
  Object.assign(iframeContainer.style, {
    position: 'fixed',
    bottom: '96px',
    right: '24px',
    width: '380px',
    height: '600px',
    maxHeight: 'calc(100vh - 120px)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    backgroundColor: '#ffffff',
    zIndex: '2147483646',
    display: 'none',
    opacity: '0',
    transform: 'translateY(20px)',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  })

  const isMobile = window.matchMedia('(max-width: 480px)').matches
  if (isMobile) {
    Object.assign(iframeContainer.style, {
      width: '100vw',
      height: '100vh',
      maxHeight: '100vh',
      bottom: '0',
      right: '0',
      borderRadius: '0',
    })
  }

  const iframe = document.createElement('iframe')
  iframe.src = widgetUrl
  iframe.setAttribute('title', 'Sohbet penceresi')
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
  })
  iframeContainer.appendChild(iframe)

  let isOpen = false
  let closeTimeoutId = null

  function toggleChat() {
    isOpen = !isOpen
    if (isOpen) {
      if (closeTimeoutId !== null) {
        clearTimeout(closeTimeoutId)
        closeTimeoutId = null
      }
      iframeContainer.style.display = 'block'
      // Force reflow so the transition runs from the initial state
      void iframeContainer.offsetHeight
      iframeContainer.style.opacity = '1'
      iframeContainer.style.transform = 'translateY(0)'
      button.innerHTML = closeIconSvg
      button.setAttribute('aria-label', 'Sohbet penceresini kapat')
    } else {
      iframeContainer.style.opacity = '0'
      iframeContainer.style.transform = 'translateY(20px)'
      closeTimeoutId = setTimeout(function () {
        iframeContainer.style.display = 'none'
        closeTimeoutId = null
      }, 200)
      button.innerHTML = chatIconSvg
      button.setAttribute('aria-label', 'Sohbet penceresini aç')
    }
  }

  button.addEventListener('mouseenter', function () {
    button.style.transform = 'scale(1.05)'
    button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'
  })
  button.addEventListener('mouseleave', function () {
    button.style.transform = 'scale(1)'
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
  })

  button.addEventListener('click', toggleChat)

  if (document.body) {
    document.body.appendChild(iframeContainer)
    document.body.appendChild(button)
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(iframeContainer)
      document.body.appendChild(button)
    })
  }
})()
