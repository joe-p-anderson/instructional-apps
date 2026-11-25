# COURSE: PHY 4300--Electricity and Magnetism
# ACTIVITY TITLE: Conductor properties


import numpy as np
import matplotlib.pyplot as plt


# Global constants
A = 5.
winlim = 10.
step = 10
eps0 = 8.86e-12 
# end constants

def mag(x,y):
    return np.sqrt(x**2+y**2)
def rhat(x,y):
    mask= x**2 + y**2 != 0
    r = mag(x,y)
    rhatx = x.copy()
    rhaty = y.copy()
    rhatx[mask]= rhatx[mask]/r[mask]
    rhaty[mask]= rhaty[mask]/r[mask]
    return (rhatx,rhaty)
def Efield(x,y,q,induce,E0x,E0y,parperp,cyl=False):
    E = 0*x
    r2 = (x**2 + y**2)
    mask = r2 < A**2
    if cyl:
        r2 = .5*np.sqrt(r2)* 1e2 # fix factor for cylinders vs spheres
    E[~mask] = 9e9 * q / r2[~mask] 
    E = E*1e4 # Converting to SI units from cm
    rx,ry = rhat(x,y)
    Ex = E*(np.cos(parperp)*rx - np.sin(parperp)*ry)
    Ey = E*(np.cos(parperp)*ry + np.sin(parperp)*rx)    
    if induce:
        Ex[~mask] += E0x 
        Ey[~mask] += E0y 
    else:
        Ex += E0x
        Ey += E0y
    return Ex,Ey

def sigma(tlist, q, induce, E0x, E0y):
    sigma = 0*tlist + q / (2*np.pi*A)
    if induce:
        sigma += eps0*(E0x * np.cos(tlist) + E0y*np.sin(tlist)) #
    sigma = sigma* 2*np.pi*A/len(tlist)
    return sigma
def potential(x,y,Q):
    if mag(x,y) > A:
        return 9e9*Q/np.sqrt(x**2+y**2)
    else:
        return 9e9*Q/A
    
    
def chargeInside(x,y,r,E0x,E0y,Q):
    pass
    
    
    
def fluxcomponent(xgs,ygs,rgs,tlist,Q,E0x,E0y):
    xgslist = rgs*np.cos(tlist) + xgs
    ygslist = rgs*np.sin(tlist) + ygs
    Ex,Ey = Efield(xgslist,ygslist,Q,True,E0x,E0y,0,cyl=True)
    Eatsurf = Ex*np.cos(tlist) + Ey*np.sin(tlist)
    return Eatsurf
    # thet = circleIntersection(xgs, ygs, rgs)
    # test = np.abs(np.mod(tlist+np.atan2(ygs,xgs)+np.pi,2*np.pi))-np.pi <= thet
    
    
    
    # Eatsurf = Eatsurf*(xgslist * np.cos(tlist) + ygslist* np.sin(tlist))/mag(xgslist,ygslist)

def circleIntersection(x,y,r):
    d = mag(x,y)
    if d + r <= A:
        # inside
        return None
    if d - r >= A:
        # outside
        return np.pi
    else: 
        xi = d/2 - (r**2-A**2)/(2*d)
        yi = np.sqrt(A**2 - xi**2)
        thet = np.atan2(yi,xi)
        return thet
        
