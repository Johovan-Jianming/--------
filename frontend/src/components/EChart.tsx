import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export default function EChart({ option, className }: { option: echarts.EChartsOption; className?: string }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    chart.current = echarts.init(el.current!, undefined, { renderer: 'canvas' })
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(el.current!)
    return () => { ro.disconnect(); chart.current?.dispose() }
  }, [])

  useEffect(() => { chart.current?.setOption(option, true) }, [option])

  return <div ref={el} className={className} />
}

export const AXIS = {
  axisLine: { lineStyle: { color: 'rgba(236,229,214,0.12)' } },
  axisTick: { show: false },
  axisLabel: { color: '#7d848d', fontFamily: 'JetBrains Mono', fontSize: 10 },
  splitLine: { lineStyle: { color: 'rgba(236,229,214,0.05)' } },
}
