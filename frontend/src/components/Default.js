const Default = ({ onClick, disabled = false }) => {
  return (
    <button className="w-full h-full flex justify-center items-center" onClick={onClick} disabled={disabled}/>
  )
}

export default Default