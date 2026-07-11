import { initPage } from '@/site/page'
import { mountAll } from '@/site/mount'
import { M05_WIDGETS } from '@/content/widgets/m05'

initPage({ module: 5 })
mountAll(M05_WIDGETS)
