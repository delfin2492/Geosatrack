path = r'apps/frontend/src/app/(dashboard)/rules/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update CustomNode for trigger_geofence
old_geofence_custom_node = """  // 3. GEOFENCE NODE
  if (data.type === 'trigger_geofence') {
    return (
      <div className={`min-w-[180px] bg-card border shadow-xl rounded-lg relative transition-all ${selectionRingClass}`}>
        <div className="bg-blue-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide rounded-t-[7px]">
          Geofence Event
        </div>
        <div className="p-2.5 bg-secondary/20 flex items-center gap-2 rounded-b-[7px]">
          <MapIcon className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-foreground">{data.label}</span>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ right: '-6px', top: '65%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
        />
      </div>
    );
  }"""

new_geofence_custom_node = """  // 3. GEOFENCE NODE (Interactive Button UI matching Select Attributes & Alarm Notification)
  if (data.type === 'trigger_geofence') {
    const gfObj = (geofences || []).find((g: any) => g.id === data.geofenceId);
    const rawGfName = data.geofenceName || (gfObj ? `${gfObj.name} (${gfObj.zoneName})` : (data.geofenceId === 'ANY' ? 'Any Geofence' : ''));
    const gfName = rawGfName || (data.geofenceId ? 'Selected Geofence' : 'Select Geofence');

    let eventLabel = 'Any Event (Enter/Exit)';
    if (data.eventType === 'GEOFENCE_ENTER') eventLabel = 'Asset Enter Geofence';
    if (data.eventType === 'GEOFENCE_EXIT') eventLabel = 'Asset Exit Geofence';

    const customName = data.customName || '';

    return (
      <div className={`min-w-[190px] bg-card border shadow-xl rounded-lg relative transition-all ${selectionRingClass}`}>
        <div className="bg-blue-700 px-3 py-1 text-white font-bold text-[11px] tracking-wide text-center select-none rounded-t-[7px]">
          Geofence Event
        </div>
        <div className="p-2.5 bg-secondary/10 flex items-center gap-2 rounded-b-[7px]">
          {/* INTERACTIVE CLICKABLE GEOFENCE SELECTOR BUTTON */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (data.onOpenGeofencePicker) {
                data.onOpenGeofencePicker(id, data);
              }
            }}
            className="flex-1 bg-white dark:bg-zinc-800 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 border border-gray-300 dark:border-zinc-700 hover:border-amber-500 rounded-md p-1.5 flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left group/btn"
          >
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0 group-hover/btn:scale-110 transition-transform">
              <MapIcon className="w-3 h-3" />
            </div>
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-[10px] font-bold text-gray-800 dark:text-gray-200 truncate max-w-[100px]">{gfName}</span>
              {customName ? (
                <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 truncate max-w-[100px]">{customName}</span>
              ) : (
                <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{eventLabel}</span>
              )}
            </div>
          </button>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{ right: '-6px', top: '65%', width: '12px', height: '12px', backgroundColor: '#a3e635', borderColor: '#3f6212', borderWidth: '2px', zIndex: 30 }}
        />
      </div>
    );
  }"""

if old_geofence_custom_node in text:
    text = text.replace(old_geofence_custom_node, new_geofence_custom_node)
    print("1. Geofence CustomNode renderer updated!")
else:
    print("1. Geofence CustomNode block NOT matched!")

# 2. Add geofencePickerNode states and handlers
old_states_anchor = "  // State for Image-matching \"Select Alarm Notification\" Modal"

new_states_block = """  // State for Image-matching "Select Geofence Event" Modal
  const [geofencePickerNode, setGeofencePickerNode] = useState<{ id: string; data: any } | null>(null);
  const [pickerGeofenceCustomName, setPickerGeofenceCustomName] = useState<string>('');
  const [pickerSelectedGeofenceAssetId, setPickerSelectedGeofenceAssetId] = useState<string>('ANY');
  const [pickerSelectedGeofenceId, setPickerSelectedGeofenceId] = useState<string>('ANY');
  const [pickerEventType, setPickerEventType] = useState<'ANY' | 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT'>('ANY');

  const [initialGeofenceState, setInitialGeofenceState] = useState<{
    customName: string;
    assetId: string;
    geofenceId: string;
    eventType: string;
  }>({ customName: '', assetId: 'ANY', geofenceId: 'ANY', eventType: 'ANY' });

  const handleOpenGeofencePicker = (nodeId: string, nodeData: any) => {
    setGeofencePickerNode({ id: nodeId, data: nodeData });
    const initCustomName = nodeData.customName || '';
    const initAssetId = nodeData.assetId || 'ANY';
    const initGeofenceId = nodeData.geofenceId || 'ANY';
    const initEventType = nodeData.eventType || 'ANY';

    setPickerGeofenceCustomName(initCustomName);
    setPickerSelectedGeofenceAssetId(initAssetId);
    setPickerSelectedGeofenceId(initGeofenceId);
    setPickerEventType(initEventType);

    setInitialGeofenceState({
      customName: initCustomName,
      assetId: initAssetId,
      geofenceId: initGeofenceId,
      eventType: initEventType,
    });
  };

  const handleApplyGeofencePicker = () => {
    if (!geofencePickerNode) return;
    pushHistory();

    const gfObj = geofences.find((g: any) => g.id === pickerSelectedGeofenceId);
    const geofenceName = gfObj ? `${gfObj.name} (${gfObj.zoneName})` : (pickerSelectedGeofenceId === 'ANY' ? 'Any Geofence' : 'Select Geofence');

    const assetObj = assets.find((a: any) => a.id === pickerSelectedGeofenceAssetId);
    const assetName = assetObj?.name || (pickerSelectedGeofenceAssetId === 'ANY' ? 'Any Asset' : 'Select Asset');

    updateNodeData(geofencePickerNode.id, 'customName', pickerGeofenceCustomName);
    updateNodeData(geofencePickerNode.id, 'assetId', pickerSelectedGeofenceAssetId);
    updateNodeData(geofencePickerNode.id, 'assetName', assetName);
    updateNodeData(geofencePickerNode.id, 'geofenceId', pickerSelectedGeofenceId);
    updateNodeData(geofencePickerNode.id, 'geofenceName', geofenceName);
    updateNodeData(geofencePickerNode.id, 'eventType', pickerEventType);

    setGeofencePickerNode(null);
  };

  const isGeofenceUnchanged =
    pickerGeofenceCustomName === initialGeofenceState.customName &&
    pickerSelectedGeofenceAssetId === initialGeofenceState.assetId &&
    pickerSelectedGeofenceId === initialGeofenceState.geofenceId &&
    pickerEventType === initialGeofenceState.eventType;

  // State for Image-matching "Select Alarm Notification" Modal"""

if old_states_anchor in text:
    text = text.replace(old_states_anchor, new_states_block)
    print("2. Geofence picker states & handlers added!")
else:
    print("2. States anchor NOT matched!")

# 3. Add onOpenGeofencePicker to ReactFlow nodes mapping
old_nodes_mapping = "onOpenNotificationPicker: (id: string, data: any) => handleOpenNotificationPicker(id, data)"
new_nodes_mapping = """onOpenNotificationPicker: (id: string, data: any) => handleOpenNotificationPicker(id, data),
                    onOpenGeofencePicker: (id: string, data: any) => handleOpenGeofencePicker(id, data),
                    geofences"""

if old_nodes_mapping in text:
    text = text.replace(old_nodes_mapping, new_nodes_mapping)
    print("3. ReactFlow nodes mapping updated!")
else:
    print("3. ReactFlow nodes mapping NOT matched!")

# 4. Add Geofence Modal Overlay JSX
old_modal_overlay_anchor = "{/* SELECT ALARM NOTIFICATION 2-COLUMN MODAL OVERLAY */}"

new_geofence_modal_jsx = """{/* SELECT GEOFENCE EVENT MODAL OVERLAY */}
      {geofencePickerNode && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setGeofencePickerNode(null)}>
          <div className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col h-[520px] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            
            {/* HEADER */}
            <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-blue-500" /> Select Geofence Event
              </h3>
              <button onClick={() => setGeofencePickerNode(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs bg-card">
              
              {/* 1. GEOFENCE NODE NAME (OPTIONAL) */}
              <div className="space-y-1 bg-blue-500/5 p-3 rounded-lg border border-blue-500/15">
                <label className="text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5">
                  <span>Geofence Event Name</span>
                  <span className="text-[10px] font-normal text-muted-foreground">(Optional - Displayed on Node)</span>
                </label>
                <Input
                  value={pickerGeofenceCustomName}
                  onChange={(e) => setPickerGeofenceCustomName(e.target.value)}
                  placeholder="e.g. Deteksi Pos Utama Gate A"
                  className="h-8 rounded-lg text-xs bg-background"
                />
              </div>

              {/* 2. SELECT ASSET */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold">Select Target Asset</label>
                <SearchableSelect
                  options={[{ label: "Any Assets (Semua Asset)", value: "ANY" }, ...assetOptions]}
                  value={pickerSelectedGeofenceAssetId}
                  onChange={(val) => setPickerSelectedGeofenceAssetId(val)}
                  alwaysSearchable={true}
                />
              </div>

              {/* 3. SELECT GEOFENCE ZONE */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold">Select Geofence Zone / Area</label>
                <SearchableSelect
                  options={[{ label: "Any Geofence (Semua Zone Geofence)", value: "ANY" }, ...geofenceOptions]}
                  value={pickerSelectedGeofenceId}
                  onChange={(val) => setPickerSelectedGeofenceId(val)}
                  alwaysSearchable={true}
                />
              </div>

              {/* 4. EVENT TYPE SELECTION */}
              <div className="space-y-2 pt-1">
                <label className="text-muted-foreground font-semibold block">Trigger Event Condition</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* ANY EVENT */}
                  <div
                    onClick={() => setPickerEventType('ANY')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col items-center text-center gap-1.5 ${
                      pickerEventType === 'ANY'
                        ? 'bg-blue-500/10 border-blue-500 font-bold text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'border-border bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span className="text-[11px]">Any Event</span>
                    <span className="text-[9px] font-normal text-muted-foreground">Masuk / Keluar</span>
                  </div>

                  {/* ENTER GEOFENCE */}
                  <div
                    onClick={() => setPickerEventType('GEOFENCE_ENTER')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col items-center text-center gap-1.5 ${
                      pickerEventType === 'GEOFENCE_ENTER'
                        ? 'bg-blue-500/10 border-blue-500 font-bold text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'border-border bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <LogIn className="w-5 h-5 text-emerald-500" />
                    <span className="text-[11px]">Enter Geofence</span>
                    <span className="text-[9px] font-normal text-muted-foreground">Asset Masuk Zone</span>
                  </div>

                  {/* EXIT GEOFENCE */}
                  <div
                    onClick={() => setPickerEventType('GEOFENCE_EXIT')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col items-center text-center gap-1.5 ${
                      pickerEventType === 'GEOFENCE_EXIT'
                        ? 'bg-blue-500/10 border-blue-500 font-bold text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'border-border bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <LogOut className="w-5 h-5 text-rose-500" />
                    <span className="text-[11px]">Exit Geofence</span>
                    <span className="text-[9px] font-normal text-muted-foreground">Asset Keluar Zone</span>
                  </div>
                </div>
              </div>

            </div>

            {/* FOOTER */}
            <div className="px-5 py-3 border-t border-border bg-card flex items-center justify-end gap-5">
              <button
                type="button"
                onClick={() => setGeofencePickerNode(null)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:opacity-80 uppercase tracking-wider transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isGeofenceUnchanged}
                onClick={handleApplyGeofencePicker}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider transition-colors cursor-pointer"
              >
                APPLY
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SELECT ALARM NOTIFICATION 2-COLUMN MODAL OVERLAY */}"""

if old_modal_overlay_anchor in text:
    text = text.replace(old_modal_overlay_anchor, new_geofence_modal_jsx)
    print("4. Geofence Modal Overlay JSX added!")
else:
    print("4. Modal Overlay anchor NOT matched!")

# 5. Remove trigger_geofence from Node Configuration sidebar modalTypes list
old_modal_types_1 = "const modalTypes = ['trigger_geofence', 'action_email', 'action_telegram', 'action_alarm', 'action_attribute'];"
new_modal_types_1 = "const modalTypes = ['action_email', 'action_telegram', 'action_alarm', 'action_attribute'];"
text = text.replace(old_modal_types_1, new_modal_types_1)

old_modal_types_2 = "{selectedNode && ['trigger_geofence', 'action_email', 'action_telegram', 'action_alarm', 'action_attribute'].includes(selectedNode.data?.type) && ("
new_modal_types_2 = "{selectedNode && ['action_email', 'action_telegram', 'action_alarm', 'action_attribute'].includes(selectedNode.data?.type) && ("
text = text.replace(old_modal_types_2, new_modal_types_2)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)