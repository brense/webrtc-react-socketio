import { useCallback, useEffect, useState } from 'react'
import { useSignalingChannel } from '../signaling'
import { useWebRTC } from './'

function useCall() {
  const [room, setRoom] = useState<string>()
  const { makeCall, onCall, me, join, leave, onJoin } = useSignalingChannel()
  const { sendMessage, addTrack, removeTrack, initDataChannel, getConnectionsForRoom } = useWebRTC()

  useEffect(() => {
    const subscriber = onCall.subscribe(({ from: remotePeerId, room }) => {
      if (remotePeerId === me()) {
        setRoom(room)
      }
    })
    return () => subscriber.unsubscribe()
  }, [onCall, me])

  useEffect(() => {
    const subscriber = onJoin.subscribe(payload => payload.room === room && initDataChannel(payload))
    return () => subscriber.unsubscribe()
  }, [onJoin, initDataChannel, room])

  const handleMakeCall = useCallback((to: string | null, options?: { isBroadcast?: boolean, [key: string]: any }) => {
    const { isBroadcast = false, ...rest } = options || {}
    makeCall({ to: to || undefined, isBroadcast, ...rest })
  }, [makeCall])

  const handleAnswerCall = useCallback(({ room, ...options }: { room: string, [key: string]: any }) => {
    join({ room, ...options })
    setRoom(room)
  }, [join])

  const handleLeaveRoom = useCallback(() => {
    if (room) {
      const conns = getConnectionsForRoom(room)
      conns.forEach(conn => conn.channel?.close())
      removeTrack(room)
      leave({ room })
      setRoom(undefined)
    } else {
      console.warn('You need to make a call before the room can be left')
    }
  }, [room, leave, removeTrack, getConnectionsForRoom])
  const handleSendMessage = useCallback((message: { [key: string]: any }) => room ? sendMessage(room, message) : console.warn('You need to make a call before you can send a message'), [room, sendMessage])
  const handleAddTrack = useCallback((track: MediaStreamTrack, ...streams: MediaStream[]) => room ? addTrack(room, track, ...streams) : console.warn('You need to make a call before you can add a track'), [room, addTrack])
  const handleRemoveTrack = useCallback(() => room ? removeTrack(room) : console.warn('You need to make a call before you can remove track'), [room, removeTrack])

  return {
    makeCall: handleMakeCall,
    answerCall: handleAnswerCall,
    room: !room ? undefined : {
      name: room,
      leaveRoom: handleLeaveRoom,
      sendMessage: handleSendMessage,
      addTrack: handleAddTrack,
      removeTrack: handleRemoveTrack
    }
  }
}

export default useCall

export type Room = Exclude<ReturnType<typeof useCall>['room'], undefined>
