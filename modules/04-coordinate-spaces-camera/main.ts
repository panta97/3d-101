import { initPage } from '@/site/page'
import { mountAll } from '@/site/mount'
import { M04_WIDGETS } from '@/content/widgets/m04'

initPage({ module: 4 })
mountAll(M04_WIDGETS)
