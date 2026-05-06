import { createElement, type SVGProps } from 'react'
import type { LocalIconComponent, LocalIconProps } from './icon-types'

type IconNode =
  | string
  | ['path', SVGProps<SVGPathElement>]
  | ['rect', SVGProps<SVGRectElement>]
  | ['circle', SVGProps<SVGCircleElement>]

interface SvgIconProps extends LocalIconProps {
  nodes: IconNode[]
}

export function SvgIcon({
  nodes,
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth = 1.5,
  strokeLinecap = 'round',
  strokeLinejoin = 'round',
  viewBox = '0 0 24 24',
  size,
  width,
  height,
  ...props
}: SvgIconProps) {
  return createElement(
    'svg',
    {
      viewBox,
      fill,
      stroke,
      strokeWidth,
      strokeLinecap,
      strokeLinejoin,
      width: width ?? size,
      height: height ?? size,
      'aria-hidden': props['aria-hidden'] ?? true,
      ...props,
    },
    ...nodes.map((node, index) => {
      if (typeof node === 'string') {
        return createElement('path', { key: index, d: node })
      }
      const [tag, nodeProps] = node
      return createElement(tag, { key: index, ...nodeProps })
    })
  )
}

export function defineIcon(nodes: IconNode[]): LocalIconComponent {
  return function LocalIcon(props) {
    return createElement(SvgIcon, { nodes, ...props })
  }
}

interface PathIconProps extends LocalIconProps {
  path: string
}

export function PathIcon({ path, ...props }: PathIconProps) {
  return createElement(SvgIcon, { nodes: [path], ...props })
}
