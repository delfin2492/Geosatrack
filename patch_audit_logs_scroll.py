path = r'apps/frontend/src/app/(dashboard)/rules/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

old_audit_card = '''          <Card className="border-border shadow-md rounded-2xl flex flex-col min-h-[400px]">
            <CardHeader className="py-3.5 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-sky-400" /> Audit Logs {selectedLogRule ? ` ${selectedLogRule.name}` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">'''

new_audit_card = '''          <Card className="border-border shadow-md rounded-2xl flex flex-col min-h-[400px]">
            <CardHeader className="py-3.5 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-sky-400" /> Audit Logs {selectedLogRule ? ` - ${selectedLogRule.name}` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[480px] overflow-y-auto pr-2">'''

if old_audit_card in text:
    text = text.replace(old_audit_card, new_audit_card)
    print('Audit logs scroll patched successfully!')
else:
    print('old_audit_card NOT matched')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)