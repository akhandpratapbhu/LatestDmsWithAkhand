import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken, getOrganizationId, orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { useAuth } from '../../auth/auth-context';
import { PageHeader } from '../../../components/PageHeader';

type DirectoryContact = {
  kind: 'USER' | 'CUSTOMER' | 'DEALER' | 'EMPLOYEE';
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  linkedUserId?: string | null;
  subtitle?: string | null;
};

type ChatRoom = {
  id: string;
  type: string;
  name: string | null;
  contactKind: string | null;
  contactId: string | null;
  members: Array<{ userId: string; user: { id: string; firstName: string; lastName: string } }>;
  messages?: Array<{ body?: string | null; messageType: string; createdAt: string }>;
};

type ChatMessage = {
  id: string;
  body: string | null;
  messageType: string;
  fileUrl?: string | null;
  fileName?: string | null;
  senderId: string;
  createdAt: string;
  sender?: { firstName: string; lastName: string };
  receipts?: Array<{ userId: string; readAt: string }>;
};

type IncomingCall = {
  id: string;
  callType: 'AUDIO' | 'VIDEO';
  callerId: string;
  calleeUserId?: string | null;
  contactKind?: string | null;
  contactId?: string | null;
};

export function ChatPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomId, setRoomId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'USER' | 'CUSTOMER' | 'DEALER' | 'EMPLOYEE'>('ALL');
  const [contactQuery, setContactQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<IncomingCall | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [groupKind, setGroupKind] = useState<'ALL' | 'USER' | 'CUSTOMER' | 'DEALER' | 'EMPLOYEE'>('ALL');
  const [groupMembers, setGroupMembers] = useState<DirectoryContact[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const chatSocket = useRef<Socket | null>(null);
  const callSocket = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const typingTimer = useRef<number | null>(null);

  const selectedRoom = useMemo(() => rooms.find((r) => r.id === roomId) ?? null, [rooms, roomId]);

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filter !== 'ALL' && c.kind !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.subtitle ?? '').toLowerCase().includes(q)
      );
    });
  }, [contacts, filter, contactQuery]);

  const groupCandidates = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    const selectedKeys = new Set(groupMembers.map((m) => `${m.kind}:${m.id}`));
    return contacts.filter((c) => {
      if (c.kind === 'USER' && c.id === user?.id) return false;
      if (selectedKeys.has(`${c.kind}:${c.id}`)) return false;
      if (groupKind !== 'ALL' && c.kind !== groupKind) return false;
      const chatUserId = c.kind === 'USER' ? c.id : c.linkedUserId;
      if (!chatUserId) return false; // group chat requires a linked login user
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.subtitle ?? '').toLowerCase().includes(q)
      );
    });
  }, [contacts, groupKind, groupMembers, groupQuery, user?.id]);

  function resolveChatUserId(contact: DirectoryContact): string | null {
    return contact.kind === 'USER' ? contact.id : contact.linkedUserId ?? null;
  }

  async function loadRooms() {
    const list = await orgApi<ChatRoom[]>('/chat/rooms');
    setRooms(list);
    if (!roomId && list[0]) setRoomId(list[0].id);
  }

  async function loadMessages(id: string) {
    const data = await orgApi<{ items: ChatMessage[] }>(`/chat/rooms/${id}/messages?limit=80`);
    setMessages([...data.items].reverse());
    await orgApi(`/chat/rooms/${id}/read`, { method: 'POST', body: JSON.stringify({}) });
  }

  useEffect(() => {
    if (!currentOrg) return;
    void orgApi<DirectoryContact[]>('/masters/directory?kinds=CUSTOMER,DEALER,EMPLOYEE,USER')
      .then(setContacts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
    void loadRooms().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id]);

  useEffect(() => {
    if (!roomId) return;
    void loadMessages(roomId).catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [roomId]);

  useEffect(() => {
    const token = getAccessToken();
    const organizationId = getOrganizationId();
    if (!token) return;

    const chat = io(`${window.location.origin}/chat`, {
      path: '/socket.io',
      auth: { token, organizationId },
      transports: ['websocket', 'polling'],
    });
    chatSocket.current = chat;
    chat.on('presence_update', (payload: { onlineUserIds?: string[] }) => {
      setOnline(payload.onlineUserIds ?? []);
    });
    chat.on('message', (msg: ChatMessage & { roomId?: string }) => {
      if (msg.roomId && msg.roomId !== roomId) {
        void loadRooms();
        return;
      }
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    chat.on('typing', (payload: { userId: string; isTyping: boolean }) => {
      if (payload.userId === user?.id) return;
      setTypingUsers((prev) => {
        if (payload.isTyping) return prev.includes(payload.userId) ? prev : [...prev, payload.userId];
        return prev.filter((id) => id !== payload.userId);
      });
    });
    chat.on('message_read', () => {
      if (roomId) void loadMessages(roomId);
    });

    const calls = io(`${window.location.origin}/calls`, {
      path: '/socket.io',
      auth: { token, organizationId },
      transports: ['websocket', 'polling'],
    });
    callSocket.current = calls;
    calls.on('call_invite', (call: IncomingCall) => {
      if (call.callerId !== user?.id) setIncoming(call);
    });
    calls.on('call_accept', async (call: IncomingCall) => {
      setIncoming(null);
      setActiveCall(call);
    });
    calls.on('call_reject', () => {
      setIncoming(null);
      setActiveCall(null);
      teardownMedia();
    });
    calls.on('call_end', () => {
      setIncoming(null);
      setActiveCall(null);
      teardownMedia();
    });
    calls.on('webrtc_offer', async (payload: { callId: string; sdp: RTCSessionDescriptionInit; fromUserId: string }) => {
      const pc = await ensurePeer(payload.callId, false);
      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      calls.emit('webrtc_answer', {
        callId: payload.callId,
        toUserId: payload.fromUserId,
        sdp: answer,
      });
    });
    calls.on('webrtc_answer', async (payload: { sdp: RTCSessionDescriptionInit }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(payload.sdp);
    });
    calls.on('webrtc_ice', async (payload: { candidate: RTCIceCandidateInit }) => {
      if (!pcRef.current || !payload.candidate) return;
      await pcRef.current.addIceCandidate(payload.candidate);
    });

    return () => {
      chat.disconnect();
      calls.disconnect();
      teardownMedia();
    };
  }, [user?.id, currentOrg?.id]);

  useEffect(() => {
    if (!roomId || !chatSocket.current) return;
    chatSocket.current.emit('join_room', { roomId });
    return () => {
      chatSocket.current?.emit('leave_room', { roomId });
    };
  }, [roomId]);

  // Attach media after call UI mounts (video refs are null until activeCall renders).
  useEffect(() => {
    if (!activeCall) return;
    if (localStream.current && localVideo.current) {
      localVideo.current.srcObject = localStream.current;
    }
  }, [activeCall]);

  function teardownMedia() {
    recorder.current?.stop();
    recorder.current = null;
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  }

  async function ensurePeer(callId: string, isCaller: boolean) {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: activeCall?.callType === 'VIDEO' || incoming?.callType === 'VIDEO',
    });
    localStream.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (ev) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = ev.streams[0] ?? null;
    };
    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !callSocket.current) return;
      const peerId =
        activeCall?.callerId === user?.id
          ? activeCall?.calleeUserId
          : activeCall?.callerId || incoming?.callerId;
      if (!peerId) return;
      callSocket.current.emit('webrtc_ice', {
        callId,
        toUserId: peerId,
        candidate: ev.candidate,
      });
    };
    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const toUserId = activeCall?.calleeUserId;
      if (toUserId) {
        callSocket.current?.emit('webrtc_offer', { callId, toUserId, sdp: offer });
      }
    }
    return pc;
  }

  async function openContact(contact: DirectoryContact) {
    const room =
      contact.kind === 'USER'
        ? await orgApi<ChatRoom>('/chat/rooms/direct', {
            method: 'POST',
            body: JSON.stringify({ peerUserId: contact.id }),
          })
        : await orgApi<ChatRoom>('/chat/rooms/direct', {
            method: 'POST',
            body: JSON.stringify({ contactKind: contact.kind, contactId: contact.id }),
          });
    await loadRooms();
    setRoomId(room.id);
  }

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const memberUserIds = Array.from(
      new Set(
        groupMembers
          .map((c) => resolveChatUserId(c))
          .filter((id): id is string => Boolean(id) && id !== user?.id),
      ),
    );
    if (!memberUserIds.length) {
      setError('Add at least one member with a linked login account');
      return;
    }
    const room = await orgApi<ChatRoom>('/chat/rooms/group', {
      method: 'POST',
      body: JSON.stringify({ name: groupName.trim(), memberUserIds }),
    });
    setGroupName('');
    setGroupMembers([]);
    setGroupQuery('');
    setShowGroupForm(false);
    await loadRooms();
    setRoomId(room.id);
  }

  function addGroupMember(contact: DirectoryContact) {
    setGroupMembers((prev) =>
      prev.some((m) => m.kind === contact.kind && m.id === contact.id)
        ? prev
        : [...prev, contact],
    );
    setGroupQuery('');
  }

  function removeGroupMember(contact: DirectoryContact) {
    setGroupMembers((prev) =>
      prev.filter((m) => !(m.kind === contact.kind && m.id === contact.id)),
    );
  }

  function emitTyping(isTyping: boolean) {
    if (!roomId || !chatSocket.current) return;
    chatSocket.current.emit('typing', { roomId, isTyping });
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!roomId || !text.trim()) return;
    if (chatSocket.current) {
      chatSocket.current.emit('message_send', { roomId, body: text });
    } else {
      await orgApi(`/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      await loadMessages(roomId);
    }
    setText('');
    emitTyping(false);
  }

  async function uploadFile(file: File) {
    if (!roomId) return;
    const fd = new FormData();
    fd.append('file', file);
    await orgApi(`/chat/rooms/${roomId}/files`, { method: 'POST', body: fd });
    await loadMessages(roomId);
  }

  async function startCall(callType: 'AUDIO' | 'VIDEO', contact?: DirectoryContact) {
    setError(null);
    try {
      const body: Record<string, unknown> = { callType, roomId: roomId || undefined };
      if (contact?.kind === 'USER') body.calleeUserId = contact.id;
      else if (contact) {
        body.contactKind = contact.kind;
        body.contactId = contact.id;
        if (contact.linkedUserId) body.calleeUserId = contact.linkedUserId;
      } else if (selectedRoom) {
        const peer = selectedRoom.members.find((m) => m.userId !== user?.id);
        if (peer) body.calleeUserId = peer.userId;
        if (selectedRoom.contactKind && selectedRoom.contactId) {
          body.contactKind = selectedRoom.contactKind;
          body.contactId = selectedRoom.contactId;
        }
      }
      if (!body.calleeUserId && !(body.contactKind && body.contactId)) {
        setError('Select a chat or contact before starting a call');
        return;
      }
      const call = await orgApi<IncomingCall>('/calls', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setActiveCall(call);
      setIncoming(null);
      if (call.calleeUserId) {
        // Let React mount the call stage (video refs) before binding media.
        window.setTimeout(() => {
          void ensurePeer(call.id, true).catch((e) =>
            setError(e instanceof Error ? e.message : 'Failed to start media'),
          );
        }, 50);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start call');
    }
  }

  async function answerCall() {
    if (!incoming) return;
    setError(null);
    try {
      await orgApi(`/calls/${incoming.id}/answer`, { method: 'POST', body: '{}' });
      const call = incoming;
      setActiveCall(call);
      setIncoming(null);
      window.setTimeout(() => {
        void ensurePeer(call.id, false).catch((e) =>
          setError(e instanceof Error ? e.message : 'Failed to open media'),
        );
      }, 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to answer call');
    }
  }

  async function rejectCall() {
    if (!incoming) return;
    await orgApi(`/calls/${incoming.id}/reject`, { method: 'POST', body: '{}' });
    setIncoming(null);
  }

  async function endCall() {
    if (!activeCall) return;
    if (recorder.current && recorder.current.state !== 'inactive') {
      recorder.current.stop();
    }
    await orgApi(`/calls/${activeCall.id}/end`, { method: 'POST', body: '{}' });
    setActiveCall(null);
    teardownMedia();
  }

  async function toggleScreenShare() {
    if (!activeCall || !pcRef.current) return;
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const track = display.getVideoTracks()[0];
    const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
    if (sender && track) await sender.replaceTrack(track);
    await orgApi(`/calls/${activeCall.id}/screen-share`, {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    });
    track?.addEventListener('ended', () => {
      void orgApi(`/calls/${activeCall.id}/screen-share`, {
        method: 'POST',
        body: JSON.stringify({ enabled: false }),
      });
    });
  }

  function startRecording() {
    if (!localStream.current || !activeCall) return;
    recordedChunks.current = [];
    const rec = new MediaRecorder(localStream.current);
    recorder.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data.size) recordedChunks.current.push(ev.data);
    };
    rec.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      const fd = new FormData();
      fd.append('file', blob, `call-${activeCall.id}.webm`);
      void orgApi(`/calls/${activeCall.id}/recording`, { method: 'POST', body: fd });
    };
    rec.start();
  }

  function roomTitle(room: ChatRoom) {
    if (room.name) return room.name;
    if (room.contactKind) return `${room.contactKind} chat`;
    const peer = room.members.find((m) => m.userId !== user?.id)?.user;
    return peer ? `${peer.firstName} ${peer.lastName}` : 'Direct chat';
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Chat</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  return (
    <div>
      <PageHeader
        title="Enterprise Messenger"
        description="Chat and call Users, Customers, Dealers, and Employees with presence, typing, receipts, files, and A/V."
      />
      {error && <div className="alert error">{error}</div>}

      {incoming && (
        <div className="alert success call-banner call-overlay-banner">
          Incoming {incoming.callType.toLowerCase()} call
          <div className="action-row">
            <button className="btn primary" type="button" onClick={() => void answerCall()}>
              Answer
            </button>
            <button className="btn secondary" type="button" onClick={() => void rejectCall()}>
              Reject
            </button>
          </div>
        </div>
      )}

      {activeCall && (
        <div className="call-stage call-overlay-stage">
          <h3>
            {activeCall.callType} call · {activeCall.id.slice(0, 8)}
          </h3>
          <div className="video-row">
            <video ref={localVideo} autoPlay muted playsInline />
            <video ref={remoteVideo} autoPlay playsInline />
          </div>
          <div className="action-row">
            <button className="btn secondary" type="button" onClick={() => void toggleScreenShare()}>
              Screen share
            </button>
            <button className="btn secondary" type="button" onClick={startRecording}>
              Record
            </button>
            <button className="btn primary" type="button" onClick={() => void endCall()}>
              End
            </button>
          </div>
        </div>
      )}

      <div className="messenger-grid">
        <aside className="messenger-side">
          <div className="messenger-side-head">
            <h2>Contacts</h2>
            <button
              type="button"
              className="btn secondary sm"
              onClick={() => setShowGroupForm((v) => !v)}
            >
              {showGroupForm ? 'Close' : 'New group'}
            </button>
          </div>

          <label className="inline-field">
            Contact type
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as 'ALL' | 'USER' | 'CUSTOMER' | 'DEALER' | 'EMPLOYEE')
              }
            >
              <option value="ALL">ALL</option>
              <option value="USER">USER</option>
              <option value="CUSTOMER">CUSTOMER</option>
              <option value="DEALER">DEALER</option>
              <option value="EMPLOYEE">EMPLOYEE</option>
            </select>
          </label>

          <label className="inline-field">
            Search contacts
            <input
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
              placeholder="Name, email, phone…"
            />
          </label>

          <ul className="contact-list">
            {filteredContacts.map((c) => {
              const presenceId = c.kind === 'USER' ? c.id : c.linkedUserId;
              const isOnline = presenceId ? online.includes(presenceId) : false;
              return (
                <li key={`${c.kind}-${c.id}`}>
                  <button type="button" className="contact-item" onClick={() => void openContact(c)}>
                    <strong>
                      <span className="pill">{c.kind}</span> {c.name}
                    </strong>
                    <span className="muted tiny">
                      {c.subtitle || c.email || c.phone || '—'}
                      {isOnline ? ' · online' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
            {!filteredContacts.length && (
              <li className="muted tiny" style={{ padding: '0.5rem' }}>
                No contacts in this filter.
              </li>
            )}
          </ul>

          {showGroupForm && (
            <form className="auth-form compact group-create" onSubmit={(e) => void createGroup(e)}>
              <h2>Create group</h2>
              <label>
                Group name
                <input
                  required
                  placeholder="e.g. Family"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </label>

              <label className="inline-field">
                Member type
                <select
                  value={groupKind}
                  onChange={(e) =>
                    setGroupKind(
                      e.target.value as 'ALL' | 'USER' | 'CUSTOMER' | 'DEALER' | 'EMPLOYEE',
                    )
                  }
                >
                  <option value="ALL">ALL</option>
                  <option value="USER">USER</option>
                  <option value="CUSTOMER">CUSTOMER</option>
                  <option value="DEALER">DEALER</option>
                  <option value="EMPLOYEE">EMPLOYEE</option>
                </select>
              </label>

              <label>
                Search & add members
                <input
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                  placeholder="Search user / customer / dealer / employee"
                />
              </label>

              {groupQuery.trim() && (
                <ul className="contact-list group-picker">
                  {groupCandidates.slice(0, 8).map((c) => (
                    <li key={`pick-${c.kind}-${c.id}`}>
                      <button type="button" className="contact-item" onClick={() => addGroupMember(c)}>
                        <strong>
                          <span className="pill">{c.kind}</span> {c.name}
                        </strong>
                        <span className="muted tiny">{c.email || c.phone || 'Add'}</span>
                      </button>
                    </li>
                  ))}
                  {!groupCandidates.length && (
                    <li className="muted tiny" style={{ padding: '0.45rem' }}>
                      No linked accounts found. Members need a login user.
                    </li>
                  )}
                </ul>
              )}

              {groupMembers.length > 0 && (
                <div className="group-chips">
                  {groupMembers.map((m) => (
                    <button
                      key={`sel-${m.kind}-${m.id}`}
                      type="button"
                      className="pill ok"
                      onClick={() => removeGroupMember(m)}
                      title="Remove"
                    >
                      [{m.kind}] {m.name} ×
                    </button>
                  ))}
                </div>
              )}

              <p className="muted tiny">
                Only contacts with a linked login can join group chat & calls.
              </p>

              <button className="btn primary" type="submit" disabled={!groupMembers.length}>
                Create group ({groupMembers.length})
              </button>
            </form>
          )}

          <h2>Chats</h2>
          <ul className="contact-list">
            {rooms.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`contact-item ${roomId === r.id ? 'active' : ''}`}
                  onClick={() => setRoomId(r.id)}
                >
                  <strong>
                    {r.type === 'GROUP' ? <span className="pill">GROUP</span> : null}{' '}
                    {roomTitle(r)}
                  </strong>
                  <span className="muted tiny">{r.messages?.[0]?.body || r.type}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="messenger-main">
          {selectedRoom ? (
            <>
              <div className="messenger-main-head">
                <div>
                  <h2>{roomTitle(selectedRoom)}</h2>
                  {selectedRoom.type === 'GROUP' && (
                    <p className="muted tiny">
                      {selectedRoom.members.length} members · group chat & call
                    </p>
                  )}
                </div>
                <div className="action-row" style={{ marginTop: 0 }}>
                  <button className="btn secondary sm" type="button" onClick={() => void startCall('AUDIO')}>
                    Audio call
                  </button>
                  <button className="btn secondary sm" type="button" onClick={() => void startCall('VIDEO')}>
                    Video call
                  </button>
                </div>
              </div>

              <div className="message-list">
                {messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.senderId === user?.id ? 'mine' : ''}`}>
                    <div className="muted tiny">
                      {m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : m.senderId} ·{' '}
                      {new Date(m.createdAt).toLocaleTimeString()}
                      {m.receipts?.length ? ' · read' : ''}
                    </div>
                    {m.messageType === 'FILE' ? (
                      <a href={m.fileUrl ?? '#'} target="_blank" rel="noreferrer">
                        {m.fileName || 'File'}
                      </a>
                    ) : (
                      <p>{m.body}</p>
                    )}
                  </div>
                ))}
              </div>
              {!!typingUsers.length && <p className="muted tiny">Typing…</p>}

              <form className="composer" onSubmit={(e) => void sendMessage(e)}>
                <input
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    emitTyping(true);
                    if (typingTimer.current) window.clearTimeout(typingTimer.current);
                    typingTimer.current = window.setTimeout(() => emitTyping(false), 1200);
                  }}
                  placeholder="Message"
                />
                <label className="btn secondary file-btn">
                  File
                  <input
                    type="file"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile(f);
                    }}
                  />
                </label>
                <button className="btn primary" type="submit">
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="empty-state">
              <strong>Start a conversation</strong>
              Pick a contact on the left, or create a group like “Family”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
