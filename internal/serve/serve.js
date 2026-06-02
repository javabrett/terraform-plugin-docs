let fetchContent = (u) => {
    fetch("/markdown/" + u)
        .then(r => r.json())
        .then(r => {
            let mdtextarea = document.querySelector('div.doc-preview textarea')
            mdtextarea.value = r.content
            mdtextarea.dispatchEvent(new Event("input", {"bubbles": true}))

            let normalizedPath = u.replace(/\\/g, '')
            document.querySelectorAll('.provider-docs-menu .menu-list-link a').forEach(a => {
                a.classList.remove('active')
            })
            let active = document.querySelector(`.provider-docs-menu a[data-path="${normalizedPath}"]`)
            if (active) active.classList.add('active')
        })

    let docPreviewEl = document.querySelector('div.doc-preview')
    if (docPreviewEl) {
        docPreviewEl.style.display = 'none'
        let parent = docPreviewEl.parentElement
        if (parent && parent.classList.contains('field')) {
            parent.style.marginBottom = '0'
        }
    }
}

let fixLayout = () => {
    let content = document.querySelector('.section-content')
    if (content) content.style.paddingTop = '0.75rem'
}

let updateMenu = (n) => {
    fetch("/markdown/menu")
        .then(r => r.text())
        .then(r => {
            n.innerHTML = r
            n.querySelectorAll('[data-section]').forEach(wrapper => {
                let link = wrapper.querySelector('.menu-list-category-link')
                let list = wrapper.querySelector('ul.menu-list')
                let icon = wrapper.querySelector('i')
                link.style.cursor = 'pointer'
                link.addEventListener('click', () => {
                    let isExpanded = wrapper.classList.contains('menu-list-category-wrapper')
                    if (isExpanded) {
                        wrapper.classList.remove('menu-list-category-wrapper')
                        if (list) list.style.display = 'none'
                        if (icon) { icon.classList.remove('fa-angle-down'); icon.classList.add('fa-angle-right') }
                    } else {
                        wrapper.classList.add('menu-list-category-wrapper')
                        if (list) list.style.display = ''
                        if (icon) { icon.classList.remove('fa-angle-right'); icon.classList.add('fa-angle-down') }
                    }
                })
            })
        })
}

let injectHeader = () => {
    fetch('/markdown/header')
        .then(r => {
            if (!r.ok || r.status === 204) return null
            return r.text()
        })
        .then(html => {
            if (!html) return
            let docPreview = document.querySelector('div.doc-preview')
            if (!docPreview) return
            let wrapper = document.createElement('div')
            wrapper.innerHTML = html
            let header = wrapper.firstElementChild
            if (!header) return
            docPreview.parentNode.insertBefore(header, docPreview)

            // wire cosmetic tab toggle
            let tabs = document.querySelector('[data-preview-tabs]')
            if (tabs) {
                tabs.querySelectorAll('.hds-tabs__tab-button').forEach(btn => {
                    btn.style.cursor = 'pointer'
                    btn.addEventListener('click', () => {
                        tabs.querySelectorAll('.hds-tabs__tab').forEach(t => t.classList.remove('hds-tabs__tab--is-selected'))
                        tabs.querySelectorAll('.hds-tabs__tab-button').forEach(b => b.setAttribute('aria-selected', 'false'))
                        btn.closest('.hds-tabs__tab').classList.add('hds-tabs__tab--is-selected')
                        btn.setAttribute('aria-selected', 'true')
                    })
                })
            }
        })
}

let textArea = new MutationObserver((mutations, ob) => {
    mutations.forEach((mutation) => {
        if (!mutation.addedNodes) return

        for (let i = 0; i < mutation.addedNodes.length; i++) {
            let node = mutation.addedNodes[i]
            if (node.nodeName === "TEXTAREA") {
                fetchContent("docs/index.md")
                injectHeader()
                ob.disconnect()
            }
        }
    })
})
let menu = new MutationObserver((mutations, ob) => {
    mutations.forEach((mutation) => {
        if (!mutation.addedNodes) return

        for (let i = 0; i < mutation.addedNodes.length; i++) {
            let node = mutation.addedNodes[i]
            if (node.nodeName === "DIV" && node.getAttribute("class") === "provider-docs-menu") {
                updateMenu(node)
                fixLayout()
                ob.disconnect()
            }
        }
    })
})

textArea.observe(document.body, {
    childList: true
    , subtree: true
    , attributes: false
    , characterData: false
})
menu.observe(document.body, {
    childList: true
    , subtree: true
    , attributes: false
    , characterData: false
})
