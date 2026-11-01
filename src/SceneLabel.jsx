import React, { useEffect, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

// Project a small DOM label over the scene. Defer DOM-root disposal so React
// never unmounts a second root during the Three renderer's commit.
export default function SceneLabel({ position, children, style = {}, visible = true, zIndexRange = [20,0] }) {
  const group = useRef(), root = useRef()
  const { gl } = useThree()
  const element = useMemo(()=>document.createElement('div'),[])
  const point = useMemo(()=>new Vector3(),[])
  useEffect(()=>{
    element.style.cssText='position:absolute;top:0;left:0;pointer-events:none;'
    gl.domElement.parentElement.appendChild(element)
    const labelRoot=createRoot(element)
    root.current=labelRoot
    return ()=>{
      element.remove()
      root.current=null
      queueMicrotask(()=>labelRoot.unmount())
    }
  },[element,gl])
  useEffect(()=>{
    root.current?.render(<div style={{transform:'translate(-50%,-50%)',...style}}>{children}</div>)
  },[children,style])
  useFrame(({ camera, size })=>{
    if (!group.current) return
    group.current.getWorldPosition(point).project(camera)
    element.style.display=visible && point.z>=-1 && point.z<=1 && Math.abs(point.x)<1.2 && Math.abs(point.y)<1.2 ? 'block' : 'none'
    element.style.transform=`translate3d(${(point.x+1)*size.width/2}px,${(1-point.y)*size.height/2}px,0)`
    element.style.zIndex=String(zIndexRange[0])
  })
  return <group ref={group} position={position}/>
}
