# Tab title: Potential field
from commonFunctions import A, winlim, Efield,potential, mag, step
import numpy as np
import matplotlib.pyplot as plt

#%% Set up plots

fig = plt.figure(1)
fig.clear()


ax1 = fig.subplots(1,1)

ax1.set_box_aspect(1)
ax1.set_xlabel("x (cm)")
ax1.set_ylabel("y (cm)")
ax1.set_xlim((-winlim,winlim))
ax1.set_ylim((-winlim,winlim))

#%% Define all static variables that do not need to be updated
xlist = np.linspace(-winlim,winlim,201)
tlist = np.linspace(0,2*np.pi,101)
xg,yg = np.meshgrid(xlist,xlist)




#%%
# Begin ui controls
Q = 1e-9 # Vary between -3 and 3 nC
x1 = -6. # No slider, only drag controls
y1 = -6.# No slider, only drag controls
x2 = 7.# No slider, only drag controls, disable if measureatInfinity
y2 = 7.# No slider, only drag controls, disable if measureatInfinity
locktosurface = False # These two toggles are mutually exclusive. Both can be false but only one can be true. Disable other toggle until returned to false.
measureatInfinity = False 
# end controls

Ex,Ey = Efield(xg,yg,Q,True,0,0,0)
if locktosurface:
    r1 = mag(x1,y1)
    x1 = A*x1/r1
    y1 = A*y1/r1
    r2 = mag(x2,y2)
    x2 = A*x2/r2
    y2 = A*y2/r2
if measureatInfinity:
    x2 = x1/mag(x1,y1) * 2*winlim
    y2 = y1/mag(x1,y1) * 2*winlim
    
# Plot electric field
a=ax1.contourf(xg,yg,mag(Ex,Ey),cmap='Blues')
b = ax1.quiver(xg[::step,::step],yg[::step,::step],Ex[::step,::step],Ey[::step,::step],color='C0')
plt.colorbar(a)

# At the top of the control pane, display the potential difference in large font
if not measureatInfinity:
    DeltaV = potential(x1,y1,Q) - potential(x2,y2,Q) # display prominently in control pane, large font
else:
    DeltaV = potential(x1,y1,Q) # display prominently in control pane, large font



ax1.plot(A*np.cos(tlist),A*np.sin(tlist),'C0',linewidth=3.) # plot conductor boundary
if locktosurface:
    t1 = np.arctan2(y1,x1)
    t2 = np.arctan2(y2,x2)
    tmin = min((t1,t2))
    tmax = max((t1,t2))
    t = np.linspace(tmin,tmax,100)
    ax1.plot(A*np.cos(t),A*np.sin(t),'w:',linewidth=3)
else:
    ax1.plot(np.array([x1,x2]),np.array([y1,y2]),'w:',linewidth=3)


# Draggable points, disable x2,y2 dragging if measureatInfinity is True    
# If locktosurface, constrain points 1,2 to the surface (x**2 + y**2)=A**2
ax1.plot(x1,y1,'o',color='C1') # Draggable point for x1,y1
ax1.plot(x2,y2,'o',color='k') # Draggable point for x2,y2




# Task pane: 
taskheader = """
How is the conductor different from the surrounding space from the perspective of the potential field?
"""
task1 = {"type":'Question',"prompt":"Try measuring the potential inside the conductor." ,"condition":"(mag(x1,y1)<A) and (measureatInfinity or (mag(x2,y2)<A))", "question": "What must be true about the potential field inside a conductor? Why?"}
task2 = {"type":'Question', "prompt":"Try measuring the potential difference of surface paths.","condition":"locktosurface", "question": "How is the potential field at the surface of a conductor related to the value inside? Why?"}

