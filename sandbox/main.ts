import { initPage } from '@/site/page'
import '@/sandbox/sandbox.css'
import { mountSandbox } from '@/sandbox/Sandbox'
import { SCENES } from '@/sandbox/scenes'

const sceneId = new URLSearchParams(location.search).get('scene')
const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0]

initPage({ root: '../', breadcrumb: `Sandbox — ${scene.title}` })
mountSandbox(document.getElementById('sandbox')!, scene.id)
