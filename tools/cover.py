G='#c9a24a'
def badge(href,size=150,uid='c'):
    return f'''<svg class="cover" width="{size}" height="{size}" viewBox="0 0 200 200" role="img" aria-label="Farmington Bay 6th Ward emblem: the Christus">
<defs><radialGradient id="{uid}bg" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#005175"/><stop offset="1" stop-color="#005175"/></radialGradient>
<clipPath id="{uid}clip"><circle cx="100" cy="100" r="66"/></clipPath>
<path id="{uid}top" d="M100 100m-82 0a82 82 0 0 1 164 0"/><path id="{uid}bot" d="M100 100m-88 0a88 88 0 0 0 176 0"/></defs>
<circle cx="100" cy="100" r="99" fill="#003a55"/><circle cx="100" cy="100" r="97" fill="url(#{uid}bg)"/>
<circle cx="100" cy="100" r="95" fill="none" stroke="{G}" stroke-width="2.2"/><circle cx="100" cy="100" r="91.5" fill="none" stroke="{G}" stroke-width=".8" opacity=".7"/>
<text fill="{G}" font-family="Georgia, 'Times New Roman', serif" font-size="12.5" font-weight="700" letter-spacing="1.5"><textPath href="#{uid}top" startOffset="50%" text-anchor="middle">FARMINGTON BAY 6TH WARD</textPath></text>
<text fill="{G}" font-family="Georgia, serif" font-size="11.5" font-style="italic" letter-spacing="1.6"><textPath href="#{uid}bot" startOffset="50%" text-anchor="middle">Come unto Christ</textPath></text>
<g fill="{G}"><path d="M17 100l3-3 3 3-3 3z"/><path d="M177 100l3-3 3 3-3 3z"/></g>
<g clip-path="url(#{uid}clip)"><rect width="200" height="200" fill="#003a55"/><image href="{href}" x="4" y="10" width="192" height="196" preserveAspectRatio="xMidYMid slice"/></g>
<circle cx="100" cy="100" r="67.5" fill="none" stroke="{G}" stroke-width="3.2"/><circle cx="100" cy="100" r="71.5" fill="none" stroke="{G}" stroke-width=".9" opacity=".8"/>
</svg>'''
