import { initPage } from '@/site/page'
import { mountAll } from '@/site/mount'
import { M02_WIDGETS } from '@/content/widgets/m02'

initPage({ module: 2 })
mountAll(M02_WIDGETS)
