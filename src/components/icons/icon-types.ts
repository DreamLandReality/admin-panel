import type { SVGProps } from 'react'

export interface LocalIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
}

export type LocalIconComponent = (props: LocalIconProps) => JSX.Element

export interface EditorIconEntry {
  name: string
  label: string
  category: string
  Icon: LocalIconComponent
}
