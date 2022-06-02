import React, { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogProps, DialogTitle, DialogContent, DialogActions, Button, TextField, RadioGroup, Radio, FormControlLabel, FormControl, FormLabel, Slider, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Icon, Box } from '@mui/material'

function SettingsDialog({ configuration, setConfiguration, ...props }: DialogProps & { configuration: RTCConfiguration, setConfiguration: (configuration: RTCConfiguration) => void }) {
  const [{ iceServers = [], iceTransportPolicy, iceCandidatePoolSize }, setConfig] = useState(configuration)
  useEffect(() => {
    setConfig(configuration)
  }, [configuration])
  const handleSave = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    props.onClose && props.onClose(e, 'backdropClick')
    setConfiguration({ iceServers: iceServers.filter(s => s.urls[0] !== ''), iceTransportPolicy, iceCandidatePoolSize })
  }, [props.onClose, setConfiguration])
  const handleAddIceServer = useCallback((event: React.FormEvent) => {
    event.preventDefault()
    const urls = (event.target as any).elements.urls.value
    const username = (event.target as any).elements.username.value
    const credential = (event.target as any).elements.credential.value;
    (event.target as HTMLFormElement).reset()
    setConfig(c => ({ ...c, iceServers: [...c.iceServers || [], { urls: urls.split(','), username, credential }] }))
  }, [])
  const handleRemoveIceServer = useCallback((index: number) => {
    iceServers.splice(index, 1)
    setConfig(c => ({ ...c, iceServers: [...iceServers] }))
  }, [iceServers])
  return <Dialog {...props} maxWidth="sm" fullWidth>
    <DialogTitle>Ice servers</DialogTitle>
    <List dense>
      {iceServers.map(({ urls, username, credential }, k) => <ListItem key={k}>
        <ListItemText primary={typeof urls === 'string' ? urls : urls.join(',')} secondary={username && credential ? `${username}:${credential}` : undefined} />
        <ListItemSecondaryAction><IconButton size="small" onClick={() => handleRemoveIceServer(k)}><Icon color="error" fontSize="small">delete</Icon></IconButton></ListItemSecondaryAction>
      </ListItem>)}
    </List>
    <DialogContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} component="form" onSubmit={handleAddIceServer}>
        <TextField
          label="Ice server uri"
          name="urls"
          variant="filled"
          margin="normal"
          fullWidth
        />
        <TextField
          label="Username"
          name="username"
          variant="filled"
          margin="normal"
        />
        <TextField
          label="Credential"
          name="credential"
          variant="filled"
          margin="normal"
        />
        <Button variant="contained" type="submit">Add</Button>
      </Box>
      <FormControl margin="normal" fullWidth>
        <FormLabel>ICE transport policy</FormLabel>
        <RadioGroup value={iceTransportPolicy} onChange={e => setConfig(c => ({ ...c, iceTransportPolicy: e.target.value as RTCIceTransportPolicy | undefined }))} row>
          <FormControlLabel value="all" control={<Radio />} label="All" />
          <FormControlLabel value="relay" control={<Radio />} label="Relay" />
        </RadioGroup>
      </FormControl>
      <FormControl margin="normal" fullWidth>
        <FormLabel>ICE transport policy</FormLabel>
        <Slider
          value={iceCandidatePoolSize || 0}
          onChange={(e, v) => setConfig(c => ({ ...c, iceCandidatePoolSize: v as number }))}
          step={1}
          marks
          min={0}
          max={10}
        />
      </FormControl>
    </DialogContent>
    <DialogActions>
      <Button onClick={e => props.onClose && props.onClose(e, 'backdropClick')}>Annuleren</Button>
      <Button onClick={handleSave} variant="contained">Opslaan</Button>
    </DialogActions>
  </Dialog>
}

export default SettingsDialog
