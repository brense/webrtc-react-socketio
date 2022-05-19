import React, { createContext, useCallback, useContext, useState } from 'react'
import { Box, Button, Dialog, DialogContent, TextField } from '@mui/material'

const UsernameDialogContext = createContext<{
  openUsernameDialog: () => Promise<string>
}>({ openUsernameDialog: async () => '' })

export function UsernameDialogProvider({ children }: React.PropsWithChildren<unknown>) {
  const [{ open, onUsername }, setState] = useState<{ open: boolean, onUsername?: (username: string) => void }>({ open: false })

  const handleSubmitUsername = useCallback((event: React.FormEvent) => {
    event.preventDefault()
    const username: string = (event.target as any).elements.username.value
    onUsername && username && onUsername(username)
    setState({ open: false })
  }, [onUsername])

  const openUsernameDialog = useCallback(() => {
    return new Promise<string>(resolve => {
      setState({ open: true, onUsername: resolve })
    })
  }, [])

  return <UsernameDialogContext.Provider value={{ openUsernameDialog }}>
    {children}
    <Dialog open={open} onClose={() => setState({ open: false })}>
      <Box component="form" onSubmit={handleSubmitUsername} autoComplete="off">
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <TextField name="username" variant="filled" label="Username" margin="normal" role="presentation" autoComplete="off" fullWidth autoFocus />
          <Button type="submit" variant="contained" size="large">Join</Button>
        </DialogContent>
      </Box>
    </Dialog>
  </UsernameDialogContext.Provider>
}

export default function useUsernameDialog() {
  return useContext(UsernameDialogContext)
}
