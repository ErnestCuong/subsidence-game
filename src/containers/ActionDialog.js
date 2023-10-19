import { useEffect } from "react";
import { CellType } from "./Cell";
import Home from "../components/Home";
import Road from "../components/Road";
import Factory from "../components/Factory";
import Water from "../components/Water";
import Trash from "../components/Trash";
import Tree from "../components/Tree";
import { Role } from "./Table";

const ActionDialog = ({ id, isOpen, setNotOpen, cellType, setCellType, role }) => {
  useEffect(() => {
    if (isOpen) {
      document.getElementById(id).showModal()
      return
    }
  }, [isOpen, id])

  const closeModal = () => {
    document.getElementById(id).close();
    setNotOpen();
  }

  const canBuildHome = cellType === CellType.DEFAULT && role === Role.RESIDENTS
  const canBuildFactory = cellType === CellType.DEFAULT && role === Role.COMPANIES
  const canBuildRoad = cellType === CellType.DEFAULT
  const canBuildTree = cellType === CellType.DEFAULT
  const canBuildTrash = cellType === CellType.DEFAULT
  const canBuildWater = cellType === CellType.DEFAULT
  const canRemoveBuilding = cellType !== CellType.DEFAULT

  return (
    <dialog id={id} className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-2xl">Choose an action</h3>
        <div className="grid grid-cols-2 gap-4 my-10">

          {canBuildHome && <div className="flex flex-row gap-2 items-center">
            <div className="w-10 h-10">
              <Home
                onClick={() => {
                  setCellType(CellType.HOME);
                  closeModal()
                }}
              />
            </div>
            <label className="font-bold">Build a Home</label>
          </div>}

          {canBuildFactory && <div className="flex flex-row gap-2 items-center">
            <div className="w-10 h-10">
              <Factory
                onClick={() => {
                  setCellType(CellType.FACTORY);
                  closeModal()
                }}
              />
            </div>
            <label className="font-bold">Build a Factory</label>
          </div>}

          {canBuildWater && <div className="flex flex-row gap-2 items-center">
            <div className="w-10 h-10">
              <Water
                onClick={() => {
                  setCellType(CellType.WATER);
                  closeModal()
                }}
              />
            </div>
            <label className="font-bold">Build a Water Channel</label>
          </div>}

          {canBuildRoad && <div className="flex flex-row gap-2 items-center">
            <div className="w-10 h-10">
              <Road
                onClick={() => {
                  setCellType(CellType.ROAD);
                  closeModal()
                }}
              />
            </div>
            <label className="font-bold">Build a Road</label>
          </div>}

          {canBuildTrash && <div className="flex flex-row gap-2 items-center">
            <div className="w-10 h-10">
              <Trash
                onClick={() => {
                  setCellType(CellType.TRASH);
                  closeModal()
                }}
              />
            </div>
            <label className="font-bold">Build a Waste Facility</label>
          </div>}

          {canBuildTree && <div className="flex flex-row gap-2 items-center">
            <div className="w-10 h-10">
              <Tree
                onClick={() => {
                  setCellType(CellType.TREE);
                  closeModal()
                }}
              />
            </div>
            <label className="font-bold">Build a Tree</label>
          </div>}

        </div>
        {canRemoveBuilding && <button
          className="btn"
          onClick={() => {
            closeModal()
            setCellType(CellType.DEFAULT);
          }}
        >
          Remove Building
        </button>}

        <div className="modal-action">
          <button className="btn" onClick={closeModal}>Close</button>
        </div>
      </div>
    </dialog>
  )
}

export default ActionDialog