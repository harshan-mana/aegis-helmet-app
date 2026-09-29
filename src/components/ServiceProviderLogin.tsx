import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Lock, Shield, AlertTriangle, CheckCircle, Database, Trash2, Plus, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

interface ServiceProviderLoginProps {
  isOpen: boolean;
  onClose: () => void;
}

const SERVICE_PROVIDER_PASSWORD = 'aegis-admin-2026';

export default function ServiceProviderLogin({ isOpen, onClose }: ServiceProviderLoginProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [newVehicle, setNewVehicle] = useState({
    registrationNumber: '',
    ownerName: '',
    ownerPhone: '',
    vehicleType: 'Motorcycle',
    makeModel: '',
    status: 'Active',
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SERVICE_PROVIDER_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      loadVehicles();
    } else {
      setError('Invalid password. Access denied.');
    }
  };

  const loadVehicles = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'vehicles'));
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    }
    setIsLoading(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedVehicles.size === 0) return;
    if (!window.confirm(`Delete ${selectedVehicles.size} vehicle(s)?`)) return;

    try {
      for (const id of selectedVehicles) {
        await deleteDoc(doc(db, 'vehicles', id));
      }
      setSelectedVehicles(new Set());
      loadVehicles();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.registrationNumber || !newVehicle.ownerName) return;

    try {
      const docId = newVehicle.registrationNumber.toUpperCase();
      await setDoc(doc(db, 'vehicles', docId), {
        ...newVehicle,
        registrationNumber: docId,
        updatedAt: new Date().toISOString(),
      });
      setNewVehicle({
        registrationNumber: '',
        ownerName: '',
        ownerPhone: '',
        vehicleType: 'Motorcycle',
        makeModel: '',
        status: 'Active',
      });
      loadVehicles();
    } catch (err) {
      console.error('Add vehicle error:', err);
    }
  };

  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(vehicles, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `rto_vehicles_${Date.now()}.json`);
    a.click();
  };

  const toggleVehicleSelection = (id: string) => {
    const next = new Set(selectedVehicles);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedVehicles(next);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setError('');
    setVehicles([]);
    setSelectedVehicles(new Set());
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleLogout()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] p-4 z-[201]">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-[#121216] border border-white/10 rounded-3xl p-7 shadow-2xl overflow-y-auto max-h-[90vh]"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-cyber-purple/10 rounded-xl">
                        <Shield className="w-6 h-6 text-cyber-purple" />
                      </div>
                      <div>
                        <h2 className="text-xl font-display font-black text-white">Service Provider</h2>
                        <p className="text-[10px] text-white/40 font-mono uppercase">RTO Database Management</p>
                      </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-white/40 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {!isAuthenticated ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1">
                          Service Provider Password
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="password"
                            placeholder="Enter provider password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-purple"
                          />
                        </div>
                      </div>
                      {error && (
                        <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                          {error}
                        </p>
                      )}
                      <button
                        type="submit"
                        className="w-full py-3.5 bg-cyber-purple text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all text-sm"
                      >
                        Authenticate
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      {/* Actions */}
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleExportData}
                          className="px-4 py-2 bg-cyber-blue text-black rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" /> Download Data
                        </button>
                        <button
                          onClick={handleDeleteSelected}
                          disabled={selectedVehicles.size === 0}
                          className="px-4 py-2 bg-cyber-red/10 border border-cyber-red/30 text-cyber-red rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Selected ({selectedVehicles.size})
                        </button>
                      </div>

                      {/* Add Vehicle Form */}
                      <form onSubmit={handleAddVehicle} className="p-4 bg-white/5 rounded-2xl space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                          <Plus className="w-4 h-4 text-cyber-green" /> Add New Vehicle
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Registration Number"
                            value={newVehicle.registrationNumber}
                            onChange={(e) => setNewVehicle({ ...newVehicle, registrationNumber: e.target.value.toUpperCase() })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Owner Name"
                            value={newVehicle.ownerName}
                            onChange={(e) => setNewVehicle({ ...newVehicle, ownerName: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                          />
                          <input
                            type="tel"
                            placeholder="Owner Phone"
                            value={newVehicle.ownerPhone}
                            onChange={(e) => setNewVehicle({ ...newVehicle, ownerPhone: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Make & Model"
                            value={newVehicle.makeModel}
                            onChange={(e) => setNewVehicle({ ...newVehicle, makeModel: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 bg-cyber-green text-black rounded-lg text-xs font-black uppercase tracking-wider"
                        >
                          Add Vehicle
                        </button>
                      </form>

                      {/* Vehicle List */}
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                          <Database className="w-4 h-4 text-cyber-blue" /> Vehicle Registry ({vehicles.length})
                        </h3>
                        {isLoading ? (
                          <p className="text-white/40 text-xs text-center py-4">Loading...</p>
                        ) : vehicles.length === 0 ? (
                          <p className="text-white/40 text-xs text-center py-4">No vehicles in database</p>
                        ) : (
                          vehicles.map((v) => (
                            <div
                              key={v.id}
                              onClick={() => toggleVehicleSelection(v.id)}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedVehicles.has(v.id)
                                  ? 'bg-cyber-red/10 border-cyber-red/30'
                                  : 'bg-white/5 border-white/10 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-white">{v.registrationNumber}</p>
                                  <p className="text-[10px] text-white/40">{v.ownerName} • {v.makeModel}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                    v.status === 'Active' ? 'bg-cyber-green/20 text-cyber-green' : 'bg-cyber-orange/20 text-cyber-orange'
                                  }`}>
                                    {v.status}
                                  </span>
                                  {selectedVehicles.has(v.id) && (
                                    <CheckCircle className="w-4 h-4 text-cyber-red" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}