# -*- coding: utf-8 -*-
"""
Created on Fri Feb 27 15:20:54 2026

@author: janderson19
"""

import numpy as np
import matplotlib.pyplot as plt

kb = 1.3806e-23
e = 1.6022e-19
winlim = 1.5


fig =plt.figure(1)
fig.clear()
ax1 = fig.subplots(1,1)
ax1.set_xlabel("$V_d$ (V)")
ax1.set_ylabel("$I_d$ (A)")

ax1.set_xlim([-winlim,winlim])
ax1.set_ylim([-winlim,winlim])

ax1.axhline(0,linewidth=1,color='k')
ax1.axvline(0,linewidth=1,color='k')

ax1.minorticks_on()

ax1.grid(which='major')
ax1.set_box_aspect(1)

# Sliders or toggles
n = 1.5 # ideality factor, between 1 and 2
I0 = 1e-6 # leakage current, choose power between -6 and -3 
Tf = 75 # Temperature, choose as thermometer from 32 to 100 deg farenheit
ideal = False # Toggle switch, disables the other sliders
# end controls

# Rerun on update
Tk = (Tf - 32) * 5/9 + 273.15
Vth = Tk*kb/e 
Vthmv = Vth*1000 # display Thermal voltage (mV) 

Vmax = np.log((2*winlim/I0) + 1)*n*Vth
Vd = np.linspace(-2,Vmax, int(1e3))

Id = I0*(np.exp(Vd/(n*Vth))-1)

if ideal:
    ax1.hlines(0,-10,0.6,color='r')
    ax1.vlines(0.6,0,10,color='r')    
else:
    plt.plot(Vd,Id,'r')    


# Tasks
# no condition for tasks 1,2, just questions:
# task 1 question: Explain the how **temperature** can affect that could affect the 'ideal' voltage value of a diode
# task 2 question: Explain the how **n** can affect that could affect the 'ideal' voltage value of a diode
# task 2 question: Explain the how **leakage current** can affect that could affect the 'ideal' voltage value of a diode



