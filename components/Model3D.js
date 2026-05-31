/**
 * Model3D — orbitable Photorealistic 3D model of the property.
 *
 * Renders Google's Photorealistic 3D Tiles via CesiumJS (lazy-loaded from CDN
 * only when this component mounts, so the heavy library never loads unless a
 * rep actually opens the 3D view). The tiles come from the Map Tiles API
 * (tile.googleapis.com/v1/3dtiles), which is what NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
 * is enabled + referrer-restricted for.
 *
 * Camera auto-orbits the house to show off, then releases to free orbit the
 * moment the rep grabs it. Degrades to a clear "unavailable" message when the
 * key is missing, coords are missing, or the area has no 3D coverage.
 *
 * NOTE: the browser key is intentionally public (it's in the page) — it's
 * protected by the HTTP-referrer restriction on the Google key, not by secrecy.
 */
import { useEffect, useRef, useState } from 'react'

const CESIUM_VER = '1.122'
const CDN = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VER}/Build/Cesium`

let cesiumPromise = null
function loadCesium() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.Cesium) return Promise.resolve(window.Cesium)
  if (cesiumPromise) return cesiumPromise
  cesiumPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-cesium]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'; link.dataset.cesium = '1'; link.href = `${CDN}/Widgets/widgets.css`
      document.head.appendChild(link)
    }
    // Cesium resolves its workers/assets relative to CESIUM_BASE_URL.
    window.CESIUM_BASE_URL = `${CDN}/`
    const s = document.createElement('script')
    s.src = `${CDN}/Cesium.js`
    s.async = true
    s.onload = () => window.Cesium ? resolve(window.Cesium) : reject(new Error('Cesium did not load'))
    s.onerror = () => reject(new Error('Cesium CDN failed'))
    document.head.appendChild(s)
  })
  return cesiumPromise
}

export default function Model3D({ lat, lng }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
  const containerRef = useRef(null)
  const creditRef = useRef(null)
  const [state, setState] = useState('loading') // loading | ready | unavailable

  useEffect(() => {
    if (!key) { setState('unavailable'); return }
    if (lat == null || lng == null) { setState('unavailable'); return }
    let viewer, cleanupListeners, cancelled = false

    loadCesium().then(async (Cesium) => {
      if (cancelled || !containerRef.current) return
      try { Cesium.Ion.defaultAccessToken = '' } catch {}

      viewer = new Cesium.Viewer(containerRef.current, {
        globe: false,                 // Photorealistic 3D Tiles include terrain + buildings
        baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
        navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false,
        infoBox: false, selectionIndicator: false,
        creditContainer: creditRef.current || undefined,  // Google attribution lives here (required)
      })
      try { viewer.scene.skyAtmosphere.show = false } catch {}

      // createGooglePhotorealistic3DTileset signature changed across Cesium
      // versions (options object vs bare key) — try both.
      let tileset
      try { tileset = await Cesium.createGooglePhotorealistic3DTileset({ key }) }
      catch { tileset = await Cesium.createGooglePhotorealistic3DTileset(key) }
      if (cancelled) { try { viewer.destroy() } catch {}; return }
      viewer.scene.primitives.add(tileset)

      // Frame + auto-orbit the property.
      const center = Cesium.Cartesian3.fromDegrees(Number(lng), Number(lat), 0)
      const pitch = Cesium.Math.toRadians(-32)
      const range = 220
      let heading = Cesium.Math.toRadians(30)
      let orbiting = true
      viewer.camera.lookAt(center, new Cesium.HeadingPitchRange(heading, pitch, range))
      const onTick = () => {
        if (!orbiting) return
        heading += 0.0016
        viewer.camera.lookAt(center, new Cesium.HeadingPitchRange(heading, pitch, range))
      }
      viewer.scene.preRender.addEventListener(onTick)

      // Stop the auto-orbit and hand control to the rep on first interaction.
      const release = () => {
        if (!orbiting) return
        orbiting = false
        viewer.scene.preRender.removeEventListener(onTick)
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY) // unlock the reference frame for free orbit
      }
      viewer.canvas.addEventListener('mousedown', release)
      viewer.canvas.addEventListener('touchstart', release)
      cleanupListeners = () => {
        viewer.canvas.removeEventListener('mousedown', release)
        viewer.canvas.removeEventListener('touchstart', release)
      }
      setState('ready')
    }).catch((e) => {
      console.error('3D model load failed:', e)
      if (!cancelled) setState('unavailable')
    })

    return () => {
      cancelled = true
      try { cleanupListeners && cleanupListeners() } catch {}
      try { viewer && viewer.destroy() } catch {}
    }
  }, [key, lat, lng])

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 880, margin: '12px auto 0' }}>
      <div ref={containerRef} style={{ width: '100%', height: 'min(60vh, 460px)', borderRadius: 14, overflow: 'hidden', background: '#0a1628', border: '1px solid rgba(255,255,255,.12)' }} />
      <div ref={creditRef} style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 6, minHeight: 14 }} />
      {state === 'loading' && (
        <div style={overlay}>Loading 3D model…</div>
      )}
      {state === 'unavailable' && (
        <div style={overlay}>3D model isn’t available for this property.</div>
      )}
      {state === 'ready' && (
        <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', fontSize: 12, color: 'rgba(255,255,255,.85)', textShadow: '0 1px 4px #000' }}>
          drag to orbit · scroll to zoom
        </div>
      )}
    </div>
  )
}

const overlay = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'rgba(255,255,255,.7)', fontSize: 14, pointerEvents: 'none',
}
