path = r'apps/frontend/src/app/(dashboard)/rules/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add NodeType action_notification to union
old_type_union = "type NodeType = 'trigger_geofence' | 'trigger_telemetry' | 'input_attribute' | 'input_number' | 'input_boolean' | 'input_string' | 'input_text' | 'math_add' | 'math_sub' | 'math_mul' | 'math_div' | 'math_avg' | 'math_pct' | 'logic_gt' | 'logic_lt' | 'logic_eq' | 'logic_neq' | 'logic_gte' | 'logic_lte' | 'logic_and' | 'logic_or' | 'logic_filter' | 'process_math' | 'action_attribute' | 'action_alarm' | 'action_email' | 'action_telegram';"
new_type_union = "type NodeType = 'trigger_geofence' | 'trigger_telemetry' | 'input_attribute' | 'input_number' | 'input_boolean' | 'input_string' | 'input_text' | 'math_add' | 'math_sub' | 'math_mul' | 'math_div' | 'math_avg' | 'math_pct' | 'logic_gt' | 'logic_lt' | 'logic_eq' | 'logic_neq' | 'logic_gte' | 'logic_lte' | 'logic_and' | 'logic_or' | 'logic_filter' | 'process_math' | 'action_attribute' | 'action_notification' | 'action_alarm' | 'action_email' | 'action_telegram';"

if old_type_union in text:
    text = text.replace(old_type_union, new_type_union)
    print("NodeType union updated with action_notification!")

# 2. Update Sidebar Outputs / Actions Palette to replace 3 alarm buttons with 1 Alarm Notification button
old_outputs_palette = '''            <div className="shrink-0 min-w-[140px]">
              <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2">Outputs / Actions</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'action_attribute')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Set Attribute Value</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_alarm')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Create Alarm</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_email')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">SMTP Email</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_telegram')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Telegram Bot</div>
              </div>
            </div>'''

new_outputs_palette = '''            <div className="shrink-0 min-w-[140px]">
              <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2">Outputs / Actions</div>
              <div className="flex lg:flex-col gap-1.5">
                <div draggable onDragStart={(e) => onDragStart(e, 'action_notification')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Alarm Notification</div>
                <div draggable onDragStart={(e) => onDragStart(e, 'action_attribute')} className="flex items-center w-full text-[10px] h-7 px-2 border border-border cursor-pointer rounded-md font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">Set Attribute Value</div>
              </div>
            </div>'''

if old_outputs_palette in text:
    text = text.replace(old_outputs_palette, new_outputs_palette)
    print("Sidebar Outputs Palette updated with Alarm Notification!")

# 3. Add CustomNode renderer for action_notification and alarm actions
old_action_node_render = '''  // 4. ACTION / OUTPUT NODES
  let ActionIcon = BellRing;
  if (data.type === 'action_email') ActionIcon = Mail;
  if (data.type === 'action_telegram') ActionIcon = Send;
  if (data.type === 'action_attribute') ActionIcon = Download;

  return (
    <div className={`min-w-[180px] bg-card border shadow-xl rounded-lg relative transition-all ${
    isNodeSelected ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background border-amber-500 shadow-2xl shadow-amber-500/30 scale-[1.03] z-50' : 'border-purple-500/50'
  }`}>
      <div className="bg-purple-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide rounded-t-[7px]">
        Action Output
      </div>
      <div className="p-2.5 bg-secondary/20 flex items-center gap-2 rounded-b-[7px]">
        <ActionIcon className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-bold text-foreground">{data.label}</span>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input_a"
        style={{ left: '-6px', top: '65%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
      />
    </div>
  );'''

new_action_node_render = '''  // 4. ALARM NOTIFICATION NODE (Interactive Button UI matching Select Attributes image)
  if (
    data.type === 'action_notification' ||
    data.type === 'action_alarm' ||
    data.type === 'action_email' ||
    data.type === 'action_telegram'
  ) {
    const channel = data.channel || (data.type === 'action_email' ? 'EMAIL' : data.type === 'action_telegram' ? 'TELEGRAM' : 'SYSTEM');
    let ChannelIcon = BellRing;
    let channelTitle = 'System Alarm';
    let channelSubtitle = 'Dashboard Bell';

    if (channel === 'EMAIL') {
      ChannelIcon = Mail;
      channelTitle = 'SMTP Email';
      channelSubtitle = data.toEmail || 'manager@company.com';
    } else if (channel === 'TELEGRAM') {
      ChannelIcon = Send;
      channelTitle = 'Telegram Bot';
      channelSubtitle = data.chatId ? `Chat ID: ${data.chatId}` : 'Set Chat ID';
    }

    return (
      <div className={`min-w-[190px] bg-card border shadow-xl rounded-lg relative transition-all ${selectionRingClass}`}>
        <div className="bg-purple-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide text-center select-none rounded-t-[7px]">
          Alarm Notification
        </div>
        <div className="p-2.5 bg-secondary/10 flex items-center gap-2 rounded-b-[7px]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (data.onOpenNotificationPicker) {
                data.onOpenNotificationPicker(id, data);
              }
            }}
            className="flex-1 bg-white dark:bg-zinc-800 hover:bg-purple-50/70 dark:hover:bg-purple-950/40 border border-gray-300 dark:border-zinc-700 hover:border-purple-500 rounded-md p-1.5 flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left group/btn"
          >
            <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center shrink-0 group-hover/btn:scale-110 transition-transform">
              <ChannelIcon className="w-3 h-3" />
            </div>
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-[10px] font-bold text-gray-800 dark:text-gray-200 truncate max-w-[110px]">{channelTitle}</span>
              <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[110px]">{channelSubtitle}</span>
            </div>
          </button>
        </div>
        <Handle
          type="target"
          position={Position.Left}
          id="input_a"
          style={{ left: '-6px', top: '65%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
        />
      </div>
    );
  }

  // 5. OTHER ACTION NODES (e.g. Set Attribute Value)
  let ActionIcon = Download;
  return (
    <div className={`min-w-[180px] bg-card border shadow-xl rounded-lg relative transition-all ${
    isNodeSelected ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background border-amber-500 shadow-2xl shadow-amber-500/30 scale-[1.03] z-50' : 'border-purple-500/50'
  }`}>
      <div className="bg-purple-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide rounded-t-[7px]">
        Action Output
      </div>
      <div className="p-2.5 bg-secondary/20 flex items-center gap-2 rounded-b-[7px]">
        <ActionIcon className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-bold text-foreground">{data.label}</span>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input_a"
        style={{ left: '-6px', top: '65%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
      />
    </div>
  );'''

if old_action_node_render in text:
    text = text.replace(old_action_node_render, new_action_node_render)
    print("CustomNode Action Notification renderer updated successfully!")

# 4. Add addNodeToFlow initialData for action_notification
old_add_node_act = "case 'action_alarm': label = 'Create Alarm'; initialData = { messageTemplate: 'Critical alert: Asset {assetName}' }; break;"
new_add_node_act = '''case 'action_notification': label = 'Alarm Notification'; initialData = { channel: 'SYSTEM', messageTemplate: 'Critical alert: Asset {assetName}' }; break;
      case 'action_alarm': label = 'Create Alarm'; initialData = { channel: 'SYSTEM', messageTemplate: 'Critical alert: Asset {assetName}' }; break;'''

if old_add_node_act in text:
    text = text.replace(old_add_node_act, new_add_node_act)
    print("addNodeToFlow action_notification added successfully!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)