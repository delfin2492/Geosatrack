path = r'apps/frontend/src/app/(dashboard)/rules/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add notification picker state and handlers after handleOpenAttributePicker
old_attr_picker_block = '''  const handleOpenAttributePicker = (nodeId: string, nodeData: any) => {
    setAttrPickerNode({ id: nodeId, data: nodeData });
    const initAssetId = nodeData.assetId && nodeData.assetId !== 'ANY' ? nodeData.assetId : (assets[0]?.id || '');
    const initAttr = nodeData.attributeName || '';
    setPickerSelectedAssetId(initAssetId);
    setPickerSelectedAttribute(initAttr);
    setInitialAssetId(initAssetId);
    setInitialAttribute(initAttr);
  };'''

new_notification_picker_block = '''  const handleOpenAttributePicker = (nodeId: string, nodeData: any) => {
    setAttrPickerNode({ id: nodeId, data: nodeData });
    const initAssetId = nodeData.assetId && nodeData.assetId !== 'ANY' ? nodeData.assetId : (assets[0]?.id || '');
    const initAttr = nodeData.attributeName || '';
    setPickerSelectedAssetId(initAssetId);
    setPickerSelectedAttribute(initAttr);
    setInitialAssetId(initAssetId);
    setInitialAttribute(initAttr);
  };

  // State for Image-matching "Select Alarm Notification" Modal
  const [notificationPickerNode, setNotificationPickerNode] = useState<{ id: string; data: any } | null>(null);
  const [pickerChannel, setPickerChannel] = useState<'SYSTEM' | 'EMAIL' | 'TELEGRAM'>('SYSTEM');
  const [pickerMessageTemplate, setPickerMessageTemplate] = useState<string>('');
  const [pickerToEmail, setPickerToEmail] = useState<string>('');
  const [pickerSubjectTemplate, setPickerSubjectTemplate] = useState<string>('');
  const [pickerChatId, setPickerChatId] = useState<string>('');

  const [initialNotificationState, setInitialNotificationState] = useState<{
    channel: string;
    messageTemplate: string;
    toEmail: string;
    subjectTemplate: string;
    chatId: string;
  }>({ channel: 'SYSTEM', messageTemplate: '', toEmail: '', subjectTemplate: '', chatId: '' });

  const handleOpenNotificationPicker = (nodeId: string, nodeData: any) => {
    setNotificationPickerNode({ id: nodeId, data: nodeData });
    const initChannel: any = nodeData.channel || (nodeData.type === 'action_email' ? 'EMAIL' : nodeData.type === 'action_telegram' ? 'TELEGRAM' : 'SYSTEM');
    const initMsg = nodeData.messageTemplate || nodeData.bodyTemplate || '';
    const initEmail = nodeData.toEmail || '';
    const initSubj = nodeData.subjectTemplate || '';
    const initChat = nodeData.chatId || '';

    setPickerChannel(initChannel);
    setPickerMessageTemplate(initMsg);
    setPickerToEmail(initEmail);
    setPickerSubjectTemplate(initSubj);
    setPickerChatId(initChat);

    setInitialNotificationState({
      channel: initChannel,
      messageTemplate: initMsg,
      toEmail: initEmail,
      subjectTemplate: initSubj,
      chatId: initChat
    });
  };

  const handleApplyNotificationPicker = () => {
    if (!notificationPickerNode) return;
    pushHistory();

    let label = 'System Alarm';
    if (pickerChannel === 'EMAIL') label = 'SMTP Email';
    if (pickerChannel === 'TELEGRAM') label = 'Telegram Bot';

    updateNodeData(notificationPickerNode.id, 'channel', pickerChannel);
    updateNodeData(notificationPickerNode.id, 'label', label);
    updateNodeData(notificationPickerNode.id, 'messageTemplate', pickerMessageTemplate);
    updateNodeData(notificationPickerNode.id, 'bodyTemplate', pickerMessageTemplate);
    updateNodeData(notificationPickerNode.id, 'toEmail', pickerToEmail);
    updateNodeData(notificationPickerNode.id, 'subjectTemplate', pickerSubjectTemplate);
    updateNodeData(notificationPickerNode.id, 'chatId', pickerChatId);

    setNotificationPickerNode(null);
  };

  const isNotificationUnchanged =
    pickerChannel === initialNotificationState.channel &&
    pickerMessageTemplate === initialNotificationState.messageTemplate &&
    pickerToEmail === initialNotificationState.toEmail &&
    pickerSubjectTemplate === initialNotificationState.subjectTemplate &&
    pickerChatId === initialNotificationState.chatId;'''

if old_attr_picker_block in text:
    text = text.replace(old_attr_picker_block, new_notification_picker_block)
    print("Notification picker state & handlers added successfully!")
else:
    print("Notification picker state & handlers NOT matched!")

# 2. Pass onOpenNotificationPicker to nodes.map
old_nodes_map = "onUpdateData: (id: string, key: string, val: any) => updateNodeData(id, key, val)"
new_nodes_map = '''onUpdateData: (id: string, key: string, val: any) => updateNodeData(id, key, val),
                    onOpenNotificationPicker: (id: string, data: any) => handleOpenNotificationPicker(id, data)'''

if old_nodes_map in text:
    text = text.replace(old_nodes_map, new_nodes_map)
    print("onOpenNotificationPicker added to nodes mapping successfully!")

# 3. Add 2-column Select Alarm Notification modal JSX before closing div of page
old_end_jsx = "      {/* SELECT ATTRIBUTES IMAGE-MATCHING MODAL OVERLAY */}"

new_notification_modal_jsx = '''      {/* SELECT ALARM NOTIFICATION IMAGE-MATCHING 2-COLUMN MODAL OVERLAY */}
      {notificationPickerNode && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setNotificationPickerNode(null)}>
          <div className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col h-[530px] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            
            {/* HEADER */}
            <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Select Alarm Notification</h3>
              <button onClick={() => setNotificationPickerNode(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TWO COLUMN CONTENT */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* LEFT COLUMN: CHANNEL SELECTION */}
              <div className="w-5/12 border-r border-border bg-secondary/10 flex flex-col">
                <div className="bg-purple-700 text-white px-3.5 py-2.5 flex items-center justify-between font-bold text-xs shadow-sm">
                  <span>Notification Channel</span>
                  <BellRing className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs">
                  {/* 1. SYSTEM ALARM */}
                  <div
                    onClick={() => setPickerChannel('SYSTEM')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                      pickerChannel === 'SYSTEM'
                        ? 'bg-purple-500/10 border-purple-500 font-bold text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'border-border bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <BellRing className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">System Alarm</span>
                      <span className="text-[10px] font-normal text-muted-foreground">Dashboard Bell & Log Alerts</span>
                    </div>
                  </div>

                  {/* 2. EMAIL (SMTP) */}
                  <div
                    onClick={() => setPickerChannel('EMAIL')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                      pickerChannel === 'EMAIL'
                        ? 'bg-purple-500/10 border-purple-500 font-bold text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'border-border bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">Email (SMTP)</span>
                      <span className="text-[10px] font-normal text-muted-foreground">Send Email Alert</span>
                    </div>
                  </div>

                  {/* 3. TELEGRAM BOT */}
                  <div
                    onClick={() => setPickerChannel('TELEGRAM')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                      pickerChannel === 'TELEGRAM'
                        ? 'bg-purple-500/10 border-purple-500 font-bold text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'border-border bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Send className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">Telegram Bot</span>
                      <span className="text-[10px] font-normal text-muted-foreground">Send Telegram Bot Message</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: CHANNEL DETAILS & MESSAGE TEMPLATES */}
              <div className="w-7/12 bg-card flex flex-col overflow-y-auto p-4 space-y-4 text-xs">
                <div className="bg-secondary/35 px-3 py-2 border border-border rounded-md font-bold text-xs text-muted-foreground flex items-center gap-2">
                  <span>Configuration Details</span>
                </div>

                {/* SYSTEM ALARM FORM */}
                {pickerChannel === 'SYSTEM' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-muted-foreground font-semibold">Alarm Message Template</label>
                      <textarea
                        value={pickerMessageTemplate}
                        onChange={(e) => setPickerMessageTemplate(e.target.value)}
                        rows={5}
                        className="w-full bg-secondary/35 border border-border p-2.5 rounded-lg text-foreground text-xs font-semibold outline-none focus:border-purple-500"
                        placeholder="e.g. Critical alert: Asset {assetName} triggered event {attributeName} with value {value}."
                      />
                    </div>
                  </div>
                )}

                {/* EMAIL FORM */}
                {pickerChannel === 'EMAIL' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-muted-foreground font-semibold">Recipient Email (To)</label>
                      <Input
                        value={pickerToEmail}
                        onChange={(e) => setPickerToEmail(e.target.value)}
                        placeholder="e.g. manager@company.com"
                        className="h-8 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground font-semibold">Subject Template</label>
                      <Input
                        value={pickerSubjectTemplate}
                        onChange={(e) => setPickerSubjectTemplate(e.target.value)}
                        placeholder="e.g. GeoMesh Alert: {assetName}"
                        className="h-8 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground font-semibold">Message Body</label>
                      <textarea
                        value={pickerMessageTemplate}
                        onChange={(e) => setPickerMessageTemplate(e.target.value)}
                        rows={4}
                        className="w-full bg-secondary/35 border border-border p-2.5 rounded-lg text-foreground text-xs font-semibold outline-none focus:border-purple-500"
                        placeholder="e.g. Alert: Asset {assetName} triggered event {attributeName} with value {value} at {time}."
                      />
                    </div>
                  </div>
                )}

                {/* TELEGRAM FORM */}
                {pickerChannel === 'TELEGRAM' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-muted-foreground font-semibold">Telegram Chat ID</label>
                      <Input
                        value={pickerChatId}
                        onChange={(e) => setPickerChatId(e.target.value)}
                        placeholder="e.g. -100123456789"
                        className="h-8 rounded-lg text-xs"
                      />
                      <div className="mt-1 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-[10px] text-yellow-600 dark:text-yellow-500 leading-tight">
                        Send a message to <a href="https://t.me/userinfobot?start=start" target="_blank" rel="noopener noreferrer" className="text-yellow-600 font-bold">@userinfobot</a> to get your Chat ID.
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground font-semibold">Telegram Message Template</label>
                      <textarea
                        value={pickerMessageTemplate}
                        onChange={(e) => setPickerMessageTemplate(e.target.value)}
                        rows={4}
                        className="w-full bg-secondary/35 border border-border p-2.5 rounded-lg text-foreground text-xs font-semibold outline-none focus:border-purple-500"
                        placeholder={'e.g. 🚨 *GeoMesh Alert*\\nAsset: *{assetName}*\\nEvent: *{attributeName}* triggered with value {value}.'}
                      />
                    </div>
                  </div>
                )}

                {/* AVAILABLE VARIABLES BADGES */}
                <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[10px] text-purple-700 dark:text-purple-300 space-y-1">
                  <div className="font-bold">Dynamic Variables (Click to Insert):</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['{assetName}', '{geofenceName}', '{attributeName}', '{value}', '{time}'].map(varName => (
                      <span
                        key={varName}
                        onClick={() => setPickerMessageTemplate(prev => (prev ? prev + ' ' + varName : varName))}
                        className="px-1.5 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 rounded font-mono text-[9px] cursor-pointer transition-colors"
                        title="Click to insert into message body"
                      >
                        {varName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* FOOTER */}
            <div className="px-5 py-3 border-t border-border bg-card flex items-center justify-end gap-5">
              <button
                type="button"
                onClick={() => setNotificationPickerNode(null)}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:opacity-80 uppercase tracking-wider transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isNotificationUnchanged}
                onClick={handleApplyNotificationPicker}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider transition-colors cursor-pointer"
              >
                APPLY
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SELECT ATTRIBUTES IMAGE-MATCHING MODAL OVERLAY */}'''

if old_end_jsx in text:
    text = text.replace(old_end_jsx, new_notification_modal_jsx)
    print("Notification picker 2-column modal JSX added successfully!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)