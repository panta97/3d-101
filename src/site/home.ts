import { TOC, initPage } from './page'

initPage()

const list = document.getElementById('toc')!
for (const entry of TOC) {
  const li = document.createElement('li')
  li.className = entry.slug ? 'toc-item' : 'toc-item is-stub'
  const inner = `
    <span class="toc-num">${entry.num}</span>
    <span class="toc-body">
      <span class="t">${entry.title}</span>
      <span class="b">${entry.blurb}</span>
    </span>
    ${entry.slug ? '' : '<span class="toc-soon">coming soon</span>'}
  `
  li.innerHTML = entry.slug ? `<a href="modules/${entry.slug}/">${inner}</a>` : `<span class="stub">${inner}</span>`
  list.append(li)
}
