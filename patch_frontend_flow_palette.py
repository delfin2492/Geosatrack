path = r'apps/frontend/src/app/(dashboard)/rules/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update addNodeToFlow
old_switch = '''    switch (type) {
      case 'trigger_geofence': label = 'Geofence Event'; initialData = { eventType: 'ANY', geofenceId: 'ANY', assetId: 'ANY' }; break;
      case 'trigger_telemetry': label = 'Telemetry Event'; initialData = { attributeName: '', assetId: 'ANY' }; break;
      case 'input_attribute': label = 'Attribute Value'; initialData = { assetId: 'ANY', attributeName: '' }; break;
      case 'logic_filter': label = 'Filter Logic'; initialData = { conditionType: 'GT', thresholdValue: '40' }; break;
      case 'process_math': label = 'Math Operation'; initialData = { operation: 'ADD' }; break;
      case 'action_alarm': label = 'Create Alarm'; initialData = { messageTemplate: 'Critical alert: Asset {assetName}' }; break;
      case 'action_email': label = 'SMTP Email'; initialData = { toEmail: '', subjectTemplate: 'Alert Notification', bodyTemplate: 'Asset {assetName} triggered an alert.' }; break;
      case 'action_telegram': label = 'Telegram Bot'; initialData = { chatId: '', messageTemplate: 'Alert triggered for {assetName}' }; break;
    }'''

new_switch = '''    switch (type) {
      case 'trigger_geofence': label = 'Geofence Event'; initialData = { eventType: 'ANY', geofenceId: 'ANY', assetId: 'ANY' }; break;
      case 'input_attribute': label = 'Attribute Value'; initialData = { assetId: 'ANY', attributeName: '' }; break;
      case 'trigger_telemetry': label = 'Attribute Value'; initialData = { assetId: 'ANY', attributeName: '' }; break;

      // Math Processors
      case 'math_add': label = 'Math (+)'; initialData = { operation: 'ADD', valueB: '0' }; break;
      case 'math_sub': label = 'Math (-)'; initialData = { operation: 'SUB', valueB: '0' }; break;
      case 'math_mul': label = 'Math (×)'; initialData = { operation: 'MUL', valueB: '1' }; break;
      case 'math_div': label = 'Math (÷)'; initialData = { operation: 'DIV', valueB: '1' }; break;
      case 'math_avg': label = 'Math (AVG)'; initialData = { operation: 'AVG' }; break;
      case 'math_pct': label = 'Math (%)'; initialData = { operation: 'PCT' }; break;
      case 'process_math': label = 'Math Operation'; initialData = { operation: 'ADD', valueB: '0' }; break;

      // Logic Processors
      case 'logic_gt': label = 'Greater Than (>)'; initialData = { conditionType: 'GT', thresholdValue: '0' }; break;
      case 'logic_lt': label = 'Less Than (<)'; initialData = { conditionType: 'LT', thresholdValue: '0' }; break;
      case 'logic_eq': label = 'Equal To (=)'; initialData = { conditionType: 'EQ', thresholdValue: '0' }; break;
      case 'logic_neq': label = 'Not Equal (!=)'; initialData = { conditionType: 'NEQ', thresholdValue: '0' }; break;
      case 'logic_gte': label = 'Greater/Equal (>=)'; initialData = { conditionType: 'GTE', thresholdValue: '0' }; break;
      case 'logic_lte': label = 'Less/Equal (<=)'; initialData = { conditionType: 'LTE', thresholdValue: '0' }; break;
      case 'logic_and': label = 'Logic AND'; initialData = { conditionType: 'AND' }; break;
      case 'logic_or': label = 'Logic OR'; initialData = { conditionType: 'OR' }; break;
      case 'logic_filter': label = 'Filter Logic'; initialData = { conditionType: 'GT', thresholdValue: '0' }; break;

      // Actions / Outputs
      case 'action_attribute': label = 'Set Attribute Value'; initialData = { targetAssetId: '', targetAttribute: '', commandValue: '' }; break;
      case 'action_alarm': label = 'Create Alarm'; initialData = { messageTemplate: 'Critical alert: Asset {assetName}' }; break;
      case 'action_email': label = 'SMTP Email'; initialData = { toEmail: '', subjectTemplate: 'Alert Notification', bodyTemplate: 'Asset {assetName} triggered an alert.' }; break;
      case 'action_telegram': label = 'Telegram Bot'; initialData = { chatId: '', messageTemplate: 'Alert triggered for {assetName}' }; break;
    }'''

if old_switch in text:
    text = text.replace(old_switch, new_switch)
    print('addNodeToFlow updated!')
else:
    print('old_switch NOT matched')

# 2. Update Sidebar Palette UI
old_palette = '''          {/* SIDEBAR NODE PALETTE */}
          <div className="w-full lg:w-52 border border-border shadow-md rounded-2xl flex lg:flex-col lg:shrink-0 bg-card overflow-x-auto lg:overflow-y-auto p-3 gap-4 lg:gap-0 lg:space-y-4">
            <div className="shrink-0 min-w-[120px]">
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Input</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'input_attribute')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Attribute value</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'trigger_telemetry')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Telemetry Event</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'trigger_geofence')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Geofence Event</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[100px]">
              <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-2">Processors</div>
              <div className="flex lg:grid lg:grid-cols-2 gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'process_math')} className="flex items-center justify-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20">Math</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_filter')} className="flex items-center justify-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20">Logic</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[120px]">
              <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2">Output / Actions</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'action_alarm')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">System Alarm</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_email')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Send Email</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_telegram')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Telegram Bot</div>
              </div>
            </div>
          </div>'''

new_palette = '''          {/* SIDEBAR NODE PALETTE */}
          <div className="w-full lg:w-56 border border-border shadow-md rounded-2xl flex lg:flex-col lg:shrink-0 bg-card overflow-x-auto lg:overflow-y-auto p-3 gap-4 lg:gap-0 lg:space-y-4">
            <div className="shrink-0 min-w-[120px]">
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Triggers / Inputs</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'input_attribute')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Attribute Value</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'trigger_geofence')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Geofence Event</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[140px]">
              <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1.5">Math Processors</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'math_add')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">+ Add</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_sub')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">- Sub</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_mul')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">× Mul</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_div')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">÷ Div</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_avg')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">AVG</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'math_pct')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">% Pct</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[140px]">
              <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1.5">Logic Processors</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_gt')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">&gt; GT</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_lt')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">&lt; LT</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_eq')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">= EQ</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_neq')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">!= NEQ</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_gte')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">&gt;= GTE</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_lte')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">&lt;= LTE</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_and')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">AND</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'logic_or')} className="flex items-center justify-center text-[10px] h-6 px-1 border border-border cursor-pointer rounded font-bold bg-green-500/10 text-green-500 hover:bg-green-500/20">OR</div>
              </div>
            </div>

            <div className="shrink-0 min-w-[140px]">
              <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2">Outputs / Actions</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'action_attribute')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Set Attribute Value</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_alarm')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">System Alarm</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_email')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Send Email</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_telegram')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Telegram Bot</div>
              </div>
            </div>
          </div>'''

if old_palette in text:
    text = text.replace(old_palette, new_palette)
    print('Sidebar Palette UI updated!')
else:
    print('old_palette NOT matched')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Frontend page.tsx palette updated!')