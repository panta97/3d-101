import { initPage } from '@/site/page'
import { mountAll } from '@/site/mount'
import { M01_WIDGETS } from '@/content/widgets/m01'

initPage({ module: 1 })
mountAll(M01_WIDGETS)
