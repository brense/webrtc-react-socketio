import React, { createContext, useCallback, useContext, useState } from 'react'
import { Snackbar, SnackbarOrigin } from '@mui/material'

const SnackbarContext = createContext<{
  open: boolean,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  message: JSX.Element | undefined,
  setMessage: React.Dispatch<React.SetStateAction<JSX.Element | undefined>>,
  anchorOrigin: SnackbarOrigin,
  setAnchorOrigin: React.Dispatch<React.SetStateAction<SnackbarOrigin>>
} | undefined>(undefined)

export function SnackbarProvider({ children }: React.PropsWithChildren<unknown>) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<React.ReactElement<any, any>>()
  const [anchorOrigin, setAnchorOrigin] = useState<SnackbarOrigin>({ vertical: 'top', horizontal: 'center', })
  return <SnackbarContext.Provider value={{ open, setOpen, message, setMessage, anchorOrigin, setAnchorOrigin }}>
    {children}
    <Snackbar open={open} autoHideDuration={6000} onClose={() => setOpen(false)} anchorOrigin={anchorOrigin}>{message}</Snackbar>
  </SnackbarContext.Provider>
}

export default function useSnackbar() {
  const snackbarContext = useContext(SnackbarContext)
  const openSnackbar = useCallback((message: React.ReactElement<any, any>, anchorOrigin?: SnackbarOrigin) => {
    snackbarContext?.setMessage(message)
    anchorOrigin && snackbarContext?.setAnchorOrigin(anchorOrigin)
    snackbarContext?.setOpen(true)
  }, [snackbarContext])
  return {
    openSnackbar
  }
}
