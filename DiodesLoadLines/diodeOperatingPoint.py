# -*- coding: utf-8 -*-
"""
Created on Fri Feb 27 15:54:40 2026

@author: janderson19
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import fsolve

kb = 1.3806e-23
e = 1.6022e-19

n = 1.5 
I0 = 1e-6 
Tf = 75 

winlim = 1.5

Tk = (Tf - 32) * 5/9 + 273.15
Vth = Tk*kb/e
Vmax = np.log((2*winlim/I0) + 1)*n*Vth



Vd = np.linspace(-2,Vmax, int(1e3))
Id = I0*(np.exp(Vd/(n*Vth))-1)

fig = plt.figure(1)
fig.clear()

ax1,ax2 = fig.subplots(2,1)
ax2.set_xlabel("$V_d$ (V)")
ax2.set_ylabel("$I_d$ (A)")

ax2.set_xlim([-winlim,winlim])
ax2.set_ylim([-winlim,winlim])

ax2.axhline(0,linewidth=1,color='k')
ax2.axvline(0,linewidth=1,color='k')
ax2.minorticks_on()

ax2.grid(which='major')
ax2.set_box_aspect(1)

ax1.set_xlabel("$V_in$ (V)")
ax1.set_ylabel("$V_R$ (V)")
ax1.set_box_aspect(1)
ax1.grid(which='major')

Vinmax = 3

Vinlist = np.linspace(-Vinmax,Vinmax,100)



# Sliders or toggles
# Load line controls
Vin = -1. # vary between -3 and +3 V
R = 10. # vary between 1 and 20 Ohm
# Diode behavior
ideal = False # Toggle switch, disables the other sliders
# end controls




oppointfunc = lambda vd, vin : (vin-vd)/R - I0*(np.exp(vd/(n*Vth))-1) 

# only when ideal toggles or R changes
Voutlist = Vinlist * 0;
if ideal:
    Voutlist[Vinlist >=0.6] = Vinlist - 0.6
else:
    guess = Voutlist + 0.6
    # in web app, replace fsolve with a Newton's method solver
    Vdlist = fsolve(oppointfunc, guess,args = (Vinlist))
    Voutlist = Vinlist - Vdlist
    
responseplt = ax1.plot(Vinlist,Voutlist,'b',label="Resistor")

# If other things change
Vdload = np.linspace(0,Vin,21)
Iload = (Vin-Vdload)/R

Voppoint = fsolve(oppointfunc, 0.6,args = Vin)
Ioppoint = (Vin-Voppoint)/R

if ideal:
    diode1 = ax2.hlines(0,-10,0.6,color='r')
    diode2 = ax2.vlines(0.6,0,10,color='r')    
else:
    diodeplt = plt.plot(Vd,Id,'r')    


loadplt = plt.plot(Vdload,Iload,'b')
vinplt = plt.plot(Vin,0,'o',color='b') # Draggable point to change Vin
Rplt = plt.plot(0,Vin/R,'o',color='b') # Draggable point to change R
opplt = plt.plot(Voppoint,Ioppoint,'bo')
Voutplt = plt.plot(Vin,Vin-Voppoint,'bo')

# annotate the load line: x-intercept is at Vin, y-intercept is at Vin/R
# task 1 question: multiple choice (1 attempt)
# The load line expression $ I_R = (V_{in}-V_d)/R$ does not depend on: 
# a) Kirchoff's voltage law (loop rule)
# b) Kirchoff's circuit law (junction rule)
# c) Ohm's law
# d) it depends on all the above.

# task 2 question: 
# Why are we are looking for the intersection between the load line and the diode curve? 


