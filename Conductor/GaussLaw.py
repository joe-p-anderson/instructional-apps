# PHY 4300: Electricity and Magnetism
# Tab title: Gauss' law corollaries

from commonFunctions import Efield, mag,rhat, A, winlim, step,sigma,fluxcomponent,eps0
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import CenteredNorm


#%% Set up plots

fig = plt.figure(1)
fig.clear()


ax1 = fig.subplots(1,1)

ax1.set_box_aspect(1)
ax1.set_xlabel("x (cm)")
ax1.set_ylabel("y (cm)")
ax1.set_xlim((-winlim,winlim))
ax1.set_ylim((-winlim,winlim))

#%% Declare grid and base fields
rlist = np.linspace(0,2*winlim,201)
tlist = np.linspace(0,2*np.pi,301)
rg,tg = np.meshgrid(rlist,tlist)

xg = rg * np.cos(tg)
yg = rg * np.sin(tg)

qxlist = np.linspace(-winlim,winlim,20)
qxg,qyg = np.meshgrid(qxlist,qxlist)


#%%
# Begin ui controls
lambd = 1e-8 # display as \(\lambda\) (C/m), vary between -10 nC/m to +10 nC/m
E0x = 1000 # Make a polar plot/joystick control for Ex,Ey with max magnitude of 2000, reset button to (0,0)
E0y = 1000
xgs = 0 # No slider, only draggable on the plot
ygs = 0 # No slider, only draggable on the plot
rgs = 7 # No slider, only draggable on the plot
tgs = 0 # No slider, only draggable on the plot
# end controls

Ex,Ey = Efield(xg,yg,lambd,True,E0x,E0y,0,cyl=True)

# Plotting electric field
a=ax1.contourf(xg,yg,mag(Ex,Ey),cmap='Blues')
plt.colorbar(a) # main colorbar

# plot electric field direction
b = ax1.quiver(qxg,qyg,*Efield(qxg,qyg,lambd,True,E0x,E0y,0,cyl=True),color='C0')
# plot the induced surface charges
c = ax1.scatter(A*np.cos(tlist),A*np.sin(tlist),c=sigma(tlist,lambd,True,E0x,E0y),cmap='coolwarm_r',norm=CenteredNorm(),s=50)



# When converting to plotly, make this scatter plot into a colored line plot.
flux = fluxcomponent(xgs,ygs,rgs,tlist,lambd,E0x,E0y)
gs = ax1.scatter(rgs*np.cos(tlist) + xgs,rgs*np.sin(tlist) + ygs,c=flux,cmap='coolwarm_r',norm=CenteredNorm(),s=50)

Qin = np.mean(flux)*eps0*2*np.pi*rgs*1e-2 # Display this quantity in the control bar
print(Qin)


ax1.plot(xgs,ygs,'wo') # Draggable to change xgs,ygs
ax1.plot(rgs*np.cos(tgs) + xgs, rgs*np.sin(tgs) + ygs,'wo') # Draggable to change rgs, tgs via polar decomposition



# Text for task section: For each question, express your answer in the form of a *modus tollens* proof.
task1 = {"type":'task', "condition":"mag(xgs,ygs) + rgs < A", 
         "goaltext": "Explore the charge in the bulk.",
         "question": "What must be true of the charge density in the bulk and why?"}
task2 = {"type":'task', "condition":"(mag(xgs,ygs) + rgs > A) and (mag(xgs,ygs) - rgs < A)",
         "goaltext": "Explore the charge at the surface",
         "question": "What must be true of the electric field at the surface of a conductor and why?"}


