import { initPage } from '@/site/page'
import { mountAll } from '@/site/mount'
import { M03_WIDGETS } from '@/content/widgets/m03'

initPage({ module: 3 })
mountAll(M03_WIDGETS)
