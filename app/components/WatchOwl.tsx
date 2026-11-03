import { useState, type FormEvent, type FocusEvent } from 'react'

type Pose = 'rest' | 'look' | 'hide'
const CARET_RANGE = 24

export function useOwlWatch() {
  const [pose, setPose] = useState<Pose>('rest')
  const [look, setLook] = useState(0)

  function follow(target: EventTarget) {
    if (!(target instanceof HTMLInputElement) || target.type === 'hidden') return
    if (target.type === 'password') {
      setPose('hide')
      return
    }
    const caret = target.selectionStart ?? target.value.length
    setPose('look')
    setLook(Math.min(caret / CARET_RANGE, 1) * 2 - 1)
  }

  return {
    pose,
    look,
    watchers: {
      onFocusCapture: (event: FocusEvent<HTMLFormElement>) => follow(event.target),
      onInputCapture: (event: FormEvent<HTMLFormElement>) => follow(event.target),
      onBlurCapture: (event: FocusEvent<HTMLFormElement>) => {
        if (!(event.relatedTarget instanceof HTMLInputElement)) setPose('rest')
      },
    },
  }
}

export function WatchOwl({ pose, look, alert = false }: { pose: Pose; look: number; alert?: boolean }) {
  const pupilX = pose === 'look' ? look * 3.5 : 0
  const pupilY = pose === 'look' ? 3 : 0
  return (
    <svg className="owl" data-pose={pose} data-alert={alert || undefined} viewBox="0 0 72 62" aria-hidden focusable="false">
      <path className="owl-body" d="M14 10 L21 17 C30 13 42 13 51 17 L58 10 C61 20 62 28 61 37 C60 50 50 57 36 57 C22 57 12 50 11 37 C10 28 11 20 14 10 Z" />
      <ellipse className="owl-belly" cx="36" cy="45" rx="14" ry="10" />
      <g className="owl-eyes">
        <circle className="owl-eye" cx="25" cy="27" r="10" />
        <circle className="owl-eye" cx="47" cy="27" r="10" />
        <g className="owl-pupils" style={{ transform: `translate(${pupilX}px, ${pupilY}px)` }}>
          <circle className="owl-pupil" cx="25" cy="27" r="4.5" />
          <circle className="owl-pupil" cx="47" cy="27" r="4.5" />
        </g>
        <g className="owl-lids">
          <rect className="owl-lid" x="14" y="16" width="22" height="22" />
          <rect className="owl-lid" x="36" y="16" width="22" height="22" />
        </g>
      </g>
      <path className="owl-beak" d="M32 33 L40 33 L36 39 Z" />
      <path className="owl-wing owl-wing-start" d="M12 34 C5 40 6 50 13 54 C18 48 19 40 12 34 Z" />
      <path className="owl-wing owl-wing-end" d="M60 34 C67 40 66 50 59 54 C54 48 53 40 60 34 Z" />
      <path className="owl-feet" d="M27 56 V61 M31 56 V61 M41 56 V61 M45 56 V61" />
    </svg>
  )
}
