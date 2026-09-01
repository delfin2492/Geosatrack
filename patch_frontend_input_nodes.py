path = r'apps/frontend/src/app/(dashboard)/rules/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update NodeType union to include input_number, input_boolean, input_string, input_text
old_type_union = "type NodeType = 'trigger_geofence' | 'trigger_telemetry' | 'input_attribute' | 'math_add'"
new_type_union = "type NodeType = 'trigger_geofence' | 'trigger_telemetry' | 'input_attribute' | 'input_number' | 'input_boolean' | 'input_string' | 'input_text' | 'math_add'"

if old_type_union in text:
    text = text.replace(old_type_union, new_type_union)
    print("NodeType union updated successfully!")
else:
    print("NodeType union NOT matched!")

# 2. Add 4 new Input palette items to Sidebar
old_palette_trigger = '''      { label: 'Attribute Value', type: 'input_attribute', icon: Activity, color: 'bg-blue-600 border-blue-500' },
      { label: 'Geofence Event', type: 'trigger_geofence', icon: MapIcon, color: 'bg-blue-600 border-blue-500' },'''

new_palette_trigger = '''      { label: 'Attribute Value', type: 'input_attribute', icon: Activity, color: 'bg-blue-600 border-blue-500' },
      { label: 'Geofence Event', type: 'trigger_geofence', icon: MapIcon, color: 'bg-blue-600 border-blue-500' },
      { label: 'Number Value', type: 'input_number', icon: Calculator, color: 'bg-blue-600 border-blue-500' },
      { label: 'Boolean Value', type: 'input_boolean', icon: ToggleLeft, color: 'bg-blue-600 border-blue-500' },
      { label: 'String Value', type: 'input_string', icon: FileText, color: 'bg-blue-600 border-blue-500' },
      { label: 'Text Template', type: 'input_text', icon: Code, color: 'bg-blue-600 border-blue-500' },'''

if old_palette_trigger in text:
    text = text.replace(old_palette_trigger, new_palette_trigger)
    print("Palette sidebar items added successfully!")
else:
    print("Palette sidebar items NOT matched!")

# 3. Add CustomNode renderers for input_number, input_boolean, input_string, input_text
old_custom_node_marker = "  // 2. ATTRIBUTE VALUE NODE (Interactive Button UI matching Select Attributes image)"

new_input_renderers = '''  // 1.1 NUMBER INPUT NODE
  if (data.type === 'input_number') {
    return (
      <div className={`min-w-[150px] bg-card border shadow-xl rounded-lg relative transition-all ${selectionRingClass}`}>
        <div className="bg-sky-600 px-3 py-1 text-white font-bold text-[11px] tracking-wide text-center select-none rounded-t-[7px]">
          Number
        </div>
        <div className="p-2 bg-secondary/10 flex items-center gap-2 rounded-b-[7px]">
          <input
            type="number"
            value={data.value ?? 0}
            onChange={(e) => updateNodeData(id, 'value', parseFloat(e.target.value) || 0)}
            className="w-full bg-background border border-border px-2 py-1 rounded text-xs font-mono text-center outline-none focus:border-amber-500 text-foreground"
          />
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ right: '-6px', top: '50%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
        />
      </div>
    );
  }

  // 1.2 BOOLEAN INPUT NODE
  if (data.type === 'input_boolean') {
    const boolVal = !!data.value;
    return (
      <div className={`min-w-[140px] bg-card border shadow-xl rounded-lg relative transition-all ${selectionRingClass}`}>
        <div className="bg-indigo-600 px-3 py-1 text-white font-bold text-[11px] tracking-wide text-center select-none rounded-t-[7px]">
          Boolean
        </div>
        <div className="p-2 bg-secondary/10 flex items-center justify-center rounded-b-[7px]">
          <button
            type="button"
            onClick={() => updateNodeData(id, 'value', !boolVal)}
            className={`w-full py-1 px-3 rounded text-xs font-bold transition-colors cursor-pointer ${
              boolVal ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-600 text-white hover:bg-rose-700'
            }`}
          >
            {boolVal ? 'TRUE (ON)' : 'FALSE (OFF)'}
          </button>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ right: '-6px', top: '50%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
        />
      </div>
    );
  }

  // 1.3 STRING INPUT NODE
  if (data.type === 'input_string') {
    return (
      <div className={`min-w-[160px] bg-card border shadow-xl rounded-lg relative transition-all ${selectionRingClass}`}>
        <div className="bg-cyan-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide text-center select-none rounded-t-[7px]">
          String
        </div>
        <div className="p-2 bg-secondary/10 flex items-center gap-2 rounded-b-[7px]">
          <input
            type="text"
            value={data.value ?? ''}
            onChange={(e) => updateNodeData(id, 'value', e.target.value)}
            placeholder="Type string..."
            className="w-full bg-background border border-border px-2 py-1 rounded text-xs outline-none focus:border-amber-500 text-foreground"
          />
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ right: '-6px', top: '50%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
        />
      </div>
    );
  }

  // 1.4 TEXT TEMPLATE INPUT NODE
  if (data.type === 'input_text') {
    return (
      <div className={`min-w-[180px] bg-card border shadow-xl rounded-lg relative transition-all ${selectionRingClass}`}>
        <div className="bg-teal-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide text-center select-none rounded-t-[7px]">
          Text Template
        </div>
        <div className="p-2 bg-secondary/10 rounded-b-[7px]">
          <textarea
            value={data.value ?? ''}
            onChange={(e) => updateNodeData(id, 'value', e.target.value)}
            placeholder="Type text template..."
            rows={3}
            className="w-full bg-background border border-border px-2 py-1 rounded text-xs outline-none focus:border-amber-500 text-foreground resize-y"
          />
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ right: '-6px', top: '50%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
        />
      </div>
    );
  }

  // 2. ATTRIBUTE VALUE NODE (Interactive Button UI matching Select Attributes image)'''

if old_custom_node_marker in text:
    text = text.replace(old_custom_node_marker, new_input_renderers)
    print("CustomNode input renderers added successfully!")
else:
    print("CustomNode input renderers NOT matched!")

# 4. Add initialData defaults in addNodeFromPalette for new input types
old_palette_switch = "case 'input_attribute': label = 'Attribute Value'; initialData = { assetId: '', attributeName: '' }; break;"
new_palette_switch = '''case 'input_attribute': label = 'Attribute Value'; initialData = { assetId: '', attributeName: '' }; break;
      case 'input_number': label = 'Number Value'; initialData = { value: 0 }; break;
      case 'input_boolean': label = 'Boolean Value'; initialData = { value: true }; break;
      case 'input_string': label = 'String Value'; initialData = { value: '' }; break;
      case 'input_text': label = 'Text Template'; initialData = { value: '' }; break;'''

if old_palette_switch in text:
    text = text.replace(old_palette_switch, new_palette_switch)
    print("addNodeFromPalette initialData updated successfully!")
else:
    print("addNodeFromPalette initialData NOT matched!")

# 5. Update onNodeClick and Modal JSX guard so only nodes requiring modal popups open the modal
old_on_node_click = '''              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
                if (node.data?.type !== 'input_attribute' && node.data?.type !== 'trigger_telemetry') {
                  setSelectedNode(node);
                }
              }}'''

new_on_node_click = '''              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
                const type = node.data?.type || node.type;
                const modalTypes = ['trigger_geofence', 'action_email', 'action_telegram', 'action_alarm', 'action_attribute'];
                if (modalTypes.includes(type)) {
                  setSelectedNode(node);
                } else {
                  setSelectedNode(null);
                }
              }}'''

if old_on_node_click in text:
    text = text.replace(old_on_node_click, new_on_node_click)
    print("onNodeClick modal guard updated successfully!")
else:
    print("onNodeClick modal guard NOT matched!")

# 6. Update Modal JSX renderer condition
old_modal_condition = "{selectedNode && selectedNode.data?.type !== 'input_attribute' && selectedNode.data?.type !== 'trigger_telemetry' && ("
new_modal_condition = "{selectedNode && ['trigger_geofence', 'action_email', 'action_telegram', 'action_alarm', 'action_attribute'].includes(selectedNode.data?.type) && ("

if old_modal_condition in text:
    text = text.replace(old_modal_condition, new_modal_condition)
    print("Modal JSX condition updated successfully!")
else:
    print("Modal JSX condition NOT matched!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)