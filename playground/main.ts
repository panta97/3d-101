import { initPage } from '@/site/page'
import '@/playground/playground.css'
import { mountPlayground } from '@/playground/Playground'

initPage({ root: '../', breadcrumb: 'Vector Playground' })
mountPlayground(document.getElementById('playground')!)
