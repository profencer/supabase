import { ChangeEvent, createContext, FC, useContext, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/router'
import { observer, useLocalObservable } from 'mobx-react-lite'
import { makeAutoObservable, runInAction } from 'mobx'
import {
  Button,
  Select,
  Typography,
  IconPlusCircle,
  IconX,
  IconChevronRight,
  Listbox,
} from '@supabase/ui'
import Divider from 'components/ui/Divider'

import { Dictionary } from '@supabase/grid'

import { useStore, withAuth } from 'hooks'
import { API_URL } from 'lib/constants'
import { get } from 'lib/common/fetch'
import {
  VERCEL_INTEGRATION_CONFIGS,
  VERCEL_DEFAULT_EXTERNAL_ID,
  INTEGRATION_ENVS_ALIAS,
} from 'lib/vercelConfigs'
import {
  createVercelEnv,
  fetchVercelProjectEnvs,
  fetchVercelProjects,
  prepareVercelEvns,
} from 'components/to-be-cleaned/Integration/Vercel.utils'
import Loading from 'components/ui/Loading'
import VercelIntegrationLayout from 'components/layouts/VercelIntegrationLayout'
import { vercelIcon, databaseIcon } from 'components/to-be-cleaned/ListIcons'

interface IVercelIntegrationStore {
  code: string
  token: string
  teamId: string
  externalId: string
  configurationId: string
  next: string
  currentProjectId?: string
  selectedVercelProjectId?: string
  vercelProjects: Dictionary<any>[]
  loading: boolean
  waitingIntegration: boolean
  projectLinks: {
    vercelProjectId?: string
    supabaseProjectRef?: string
    error?: string
    result?: { status: 'waiting' | 'success' | 'fail'; message?: string }
  }[]

  isDeployButtonFlow: boolean
  isSupabaseProjectListEmpty: boolean
  integrationComplete: boolean
  queryParams: Dictionary<string>
  projectLinkRemaining: number
  vercelProjectsAvailable: Dictionary<string>[]

  loadInitialData: () => void
}

class VercelIntegrationStore implements IVercelIntegrationStore {
  code: string = ''
  token: string = ''
  teamId: string = ''
  externalId: string = ''
  configurationId: string = ''
  next: string = ''
  currentProjectId?: string
  selectedVercelProjectId?: string
  vercelProjects: Dictionary<any>[] = []
  loading: boolean = true
  // @ts-ignore
  waitingIntegration: boolean
  projectLinks: {
    vercelProjectId?: string
    supabaseProjectRef?: string
    error?: string
    result?: { status: 'waiting' | 'success' | 'fail'; message?: string }
  }[] = [
    {
      vercelProjectId: undefined,
      supabaseProjectRef: undefined,
    },
  ]

  constructor() {
    makeAutoObservable(this)
    // this.globalStore = globalStore
  }

  get isDeployButtonFlow() {
    return !!this.currentProjectId
  }

  get isSupabaseProjectListEmpty() {
    const { app } = useStore()
    const projects = app.projects.list()
    return projects.length == 0
  }

  // @ts-ignore
  get queryParams() {
    return {
      token: this.token,
      teamId: this.teamId,
      'external-id': this.externalId,
      configurationId: this.configurationId,
      vercelProjectId: this.selectedVercelProjectId,
      next: this.next,
    }
  }

  get projectLinkRemaining() {
    if (!this.vercelProjects) return 0
    const temp = this.vercelProjects?.length - this.projectLinks.length
    return temp >= 0 ? temp : 0
  }

  get vercelProjectsAvailable() {
    const existed = this.projectLinks.map((x) => x.vercelProjectId)
    const filtered = this.vercelProjects.filter((x) => existed.includes(x.id) == false)
    return filtered
  }

  get integrationComplete() {
    if (!this.waitingIntegration) return false
    const pendingItegrations = this.projectLinks.filter((x) => !x.result || !x.result?.message)
    return pendingItegrations.length == 0
  }

  loadInitialData() {
    this.getQueryParams()
    this.getVercelAuthToken()
  }

  getQueryParams() {
    const params = new URLSearchParams(window.location.search)
    this.code = params.get('code') as string
    this.configurationId = params.get('configurationId') as string
    this.currentProjectId = params.get('currentProjectId') as string
    this.next = params.get('next') as string
    this.externalId = params.get('external-id') || VERCEL_DEFAULT_EXTERNAL_ID
    this.teamId = params.get('teamId') as string

    // double check and set VERCEL_DEFAULT_EXTERNAL_ID as default externalId if config invalid
    const config = VERCEL_INTEGRATION_CONFIGS.find((x) => x.id == this.externalId)
    if (!config) this.externalId = VERCEL_DEFAULT_EXTERNAL_ID
  }

  async getVercelAuthToken() {
    const query = new URLSearchParams({
      code: this.code,
    }).toString()
    const response = await get(`${API_URL}/vercel/token?${query}`)
    if (!response.errror) {
      this.token = response.token
      // retrieve vercel projects after getting token
      await this.getVercelProjects()
      this.loading = false
    } else {
      toast.error('Retrieve vercel token failed')
      this.loading = false
    }
  }
  async getVercelProjects() {
    const { data, error }: any = await fetchVercelProjects({
      vercelTeamId: this.teamId,
      vercelToken: this.token,
    })
    if (error) {
      toast.error(error)
    } else {
      this.vercelProjects = data
      // if currentProjectId available. Auto select it
      if (data && this.currentProjectId) {
        // @ts-ignore
        const found = data.find((x: { id: string }) => (x.id = this.currentProjectId))
        if (found) this.selectedVercelProjectId = found.id
      }
    }
  }
}
const PageContext = createContext<IVercelIntegrationStore>(undefined!)

type VercelIntegrationProps = {} & any
const VercelIntegration: FC<VercelIntegrationProps> = ({}) => {
  // @ts-ignore
  const _store: IVercelIntegrationStore = useLocalObservable(() => new VercelIntegrationStore())

  useEffect(() => {
    _store.loadInitialData()
  }, [])

  return (
    <PageContext.Provider value={_store}>
      <VercelIntegrationLayout>
        {_store.loading ? (
          <Connecting />
        ) : _store.isDeployButtonFlow ? (
          <IntegrationProject />
        ) : _store.isSupabaseProjectListEmpty ? (
          <ProjectLinksEmptyState />
        ) : (
          <ProjectLinks />
        )}
      </VercelIntegrationLayout>
    </PageContext.Provider>
  )
}
export default withAuth(observer(VercelIntegration))

const Connecting = () => (
  <div className="w-full h-full flex flex-col items-center justify-center">
    <div className="w-32 flex items-center justify-center">
      <Loading />
    </div>
    <Typography.Text>Connecting...</Typography.Text>
  </div>
)

const ProjectLinksEmptyState = () => (
  <div className="flex flex-col space-y-4">
    <Typography.Text>
      You haven't created a Supabase project yet. Get started by creating a new Supabase project,
      then close this window and retry adding integration.
    </Typography.Text>
    <Typography.Link href="https://app.supabase.io">
      Start a new Supabase project<span aria-hidden="true"> &rarr;</span>
    </Typography.Link>
  </div>
)

const UNDEFINED_SELECT_VALUE = 'undefined'
const IntegrationProject: FC = observer(() => {
  const _store = useContext(PageContext)
  const router = useRouter()
  const [name, setName] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>()

  useEffect(() => {
    const config = VERCEL_INTEGRATION_CONFIGS.find((x) => x.id == _store.externalId)
    if (!config && !errorMsg) setErrorMsg('This integration is not supported right now')
    else setName(config?.name || _store.externalId)
  }, [_store.externalId])

  function onClick() {
    if (!_store.selectedVercelProjectId) {
      setErrorMsg('Error: please select a vercel project to continue')
      return
    }
    if (!_store.token || _store.token == '') {
      setErrorMsg('Error: vercel auth token is invalid')
      return
    }

    setLoading(true)
    const query = new URLSearchParams(_store.queryParams).toString()
    router.push(`/vercel/setupOrg?${query}`)
  }

  function onVercelProjectChange(e: ChangeEvent<HTMLSelectElement>) {
    setErrorMsg(undefined)
    _store.selectedVercelProjectId =
      e.target.value != UNDEFINED_SELECT_VALUE ? e.target.value : undefined
  }

  return (
    <div className="flex flex-col w-full items-center">
      <div className="w-full mb-8">
        <Select
          label="Vercel project"
          value={_store.selectedVercelProjectId}
          onChange={onVercelProjectChange}
        >
          <Select.Option value={UNDEFINED_SELECT_VALUE}>---</Select.Option>
          {_store.vercelProjects?.map((x) => {
            return (
              <Select.Option key={x.id} value={x.id}>
                {x.name}
              </Select.Option>
            )
          })}
        </Select>
      </div>
      <div
        className="w-full bg-panel-header-light dark:bg-panel-header-dark border 
      border-border-secondary-light dark:border-border-secondary-dark rounded-sm"
      >
        <div className="flex justify-between items-center p-6">
          <Typography.Title level={4} className="my-auto mr-8 capitalize">
            {name}
          </Typography.Title>
          <Button disabled={loading || !!errorMsg} loading={loading} onClick={onClick}>
            Deploy
          </Button>
        </div>
      </div>
      {errorMsg && (
        <Typography.Text className="py-4" type="danger">
          {errorMsg}
        </Typography.Text>
      )}
    </div>
  )
})

const delayTimer = (ms: number) => new Promise((res) => setTimeout(res, ms))
const defaultVercelEnvs = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    alias: INTEGRATION_ENVS_ALIAS.ENDPOINT,
    type: 'encrypted',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    alias: INTEGRATION_ENVS_ALIAS.ANONKEY,
    type: 'encrypted',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    alias: INTEGRATION_ENVS_ALIAS.SERVICEKEY,
    type: 'encrypted',
  },
]
const ProjectLinks: FC = observer(() => {
  const _store = useContext(PageContext)

  async function onSubmit() {
    if (validateInputs()) {
      runInAction(() => {
        _store.waitingIntegration = true
      })
      for (let i = 0; i < _store.projectLinks.length; i++) {
        const item = _store.projectLinks[i]
        runInAction(() => {
          item.result = { status: 'waiting' }
        })

        // pull vercel project env, check if supabase env is existed or not
        const { data: existedEnvs, error: fetchEnvsError }: any = await fetchVercelProjectEnvs({
          id: item.vercelProjectId as string,
          vercelTeamId: _store.teamId,
          vercelToken: _store.token,
        })
        if (fetchEnvsError) {
          console.log('envsError: ', fetchEnvsError)
          runInAction(() => {
            item.result = {
              status: 'fail',
              message: 'Error: validate Vercel project envs fails',
            }
          })
          continue
        }
        const found = existedEnvs.find((x: any) => x.key.includes('SUPABASE'))
        if (!!found) {
          console.log('Existed Supabase env: ', found)
          runInAction(() => {
            item.result = {
              status: 'fail',
              message: 'Error: this Vercel project already contains Supabase envs',
            }
          })
          continue
        }
        // If not, pull project detail info
        const projectDetails = await get(`${API_URL}/props/project/${item.supabaseProjectRef}/api`)
        if (projectDetails.error) {
          console.log('project info error: ', projectDetails.error)
          runInAction(() => {
            item.result = {
              status: 'fail',
              message: 'Error: fetch Supabase project details fails',
            }
          })
          continue
        }

        // Then create env for vercel project with supabase project
        const vercelEnvs = prepareVercelEvns(defaultVercelEnvs, {
          endpoint: `https://${projectDetails.autoApiService.endpoint}`,
          anon_key: projectDetails.autoApiService.defaultApiKey,
          service_key: projectDetails.autoApiService.serviceApiKey,
        })

        await Promise.allSettled(
          vercelEnvs.map(async (env: any) => {
            try {
              const data = await createVercelEnv({
                ...env,
                vercelProjectId: item.vercelProjectId,
                vercelTeamId: _store.teamId,
                vercelToken: _store.token,
              })
              return data
            } catch (err) {
              console.error(`Error: ${err}`)
            }
          })
        )

        runInAction(() => {
          item.result = {
            status: 'success',
            message: 'Projects linked successfully',
          }
        })
        await delayTimer(1000)
      }
    }
  }

  function validateInputs() {
    let isValid = true
    for (let i = 0; i < _store.projectLinks.length; i++) {
      const item = _store.projectLinks[i]
      if (!item.supabaseProjectRef || !item.vercelProjectId) {
        isValid = false
        runInAction(() => {
          _store.projectLinks[i].error =
            'Invalid selection. Please choose a Vercel project and a Supabase project to link.'
        })
      }
    }

    return isValid
  }

  function onFinish() {
    window.location.href = _store.next
  }

  function displayButton() {
    if (!_store.integrationComplete) {
      return (
        <Button onClick={onSubmit} loading={_store.waitingIntegration}>
          Add Integration
        </Button>
      )
    }

    if (_store.projectLinks.every(({ result: { status } }: any) => status === 'success')) {
      onFinish()
    } else {
      return <Button onClick={onFinish}>Finish</Button>
    }
  }

  return (
    <div className="flex flex-col w-full space-y-6">
      <div>
        <Typography.Title level={4}>Link Vercel to Supabase</Typography.Title>
        <Typography.Text>
          Choose which of your Vercel projects to link to your existing Supabase projects.
        </Typography.Text>
      </div>
      <Divider light />
      <div className="space-y-2">
        <div className="flex justify-between">
          <Typography.Text className="" type="secondary">
            Vercel Projects
          </Typography.Text>
          <div />
          <Typography.Text className="" type="secondary">
            Supabase Projects
          </Typography.Text>
        </div>
        <ProjectLinkList />
        <Divider light />
        <div className="py-4 flex justify-end">{displayButton()}</div>
      </div>
    </div>
  )
})

const ProjectLinkList: FC = observer(() => {
  const _store = useContext(PageContext)

  function addProjectLink() {
    runInAction(() => {
      _store.projectLinks.push({
        vercelProjectId: undefined,
        supabaseProjectRef: undefined,
      })
    })
  }
  return (
    <>
      <ul>
        {_store.projectLinks.map((x, idx) => (
          <ProjectLinkItem
            key={`project-link-${idx}`}
            idx={idx}
            vercelProjectId={x.vercelProjectId}
            supabaseProjectRef={x.supabaseProjectRef}
            error={x.error}
            result={x.result}
          />
        ))}
      </ul>
      <div className="py-2">
        {_store.projectLinkRemaining == 0 ? (
          <Typography.Text type="secondary" small>
            All Vercel projects for selected scope have been added
          </Typography.Text>
        ) : (
          <div className="flex items-center space-x-2">
            <Button
              icon={<IconPlusCircle />}
              type="default"
              onClick={addProjectLink}
              disabled={_store.projectLinkRemaining == 0 || _store.waitingIntegration}
            >
              {`Add another Vercel Project`}
            </Button>
            <Typography.Text type="secondary" small>
              {_store.projectLinkRemaining} project(s) remaining
            </Typography.Text>
          </div>
        )}
      </div>
    </>
  )
})

type ProjectLinkItemProps = {
  idx: number
  vercelProjectId?: string
  supabaseProjectRef?: string
  error?: string
  result?: { status: 'waiting' | 'success' | 'fail'; message?: string }
}
const ProjectLinkItem: FC<ProjectLinkItemProps> = observer(
  ({ idx, vercelProjectId, supabaseProjectRef, error, result }) => {
    const _store = useContext(PageContext)
    const selectedVercelProject = _store.vercelProjects.find((x) => x.id == vercelProjectId)

    const { app } = useStore()
    const sortedProjects = app.projects.list()

    function onVercelProjectChange(e: string) {
      const value = e != UNDEFINED_SELECT_VALUE ? e : undefined
      runInAction(() => {
        _store.projectLinks[idx].vercelProjectId = value
        _store.projectLinks[idx].error = undefined
      })
    }

    function onSupabaseProjectChange(e: string) {
      const value = e != UNDEFINED_SELECT_VALUE ? e : undefined
      runInAction(() => {
        _store.projectLinks[idx].supabaseProjectRef = value
        _store.projectLinks[idx].error = undefined
      })
    }

    function onRemove() {
      runInAction(() => {
        const filtered = _store.projectLinks.filter((_, index) => index != idx)
        _store.projectLinks = filtered
      })
    }

    return (
      <li className="py-2">
        {console.log('re-rendered the ProjectLinkItem')}
        <div className="relative flex w-full space-x-2">
          <div className="flex-grow w-1/2">
            <Listbox
              value={vercelProjectId ?? UNDEFINED_SELECT_VALUE}
              onChange={onVercelProjectChange}
            >
              <Listbox.Option value={UNDEFINED_SELECT_VALUE} label="Choose a project" disabled>
                Choose a project
              </Listbox.Option>
              {selectedVercelProject && (
                <Listbox.Option
                  value={selectedVercelProject.id}
                  label={selectedVercelProject.name}
                  addOnBefore={() => vercelIcon}
                >
                  {selectedVercelProject.name}
                </Listbox.Option>
              )}
              {_store.vercelProjectsAvailable.map((x) => (
                <Listbox.Option
                  key={x.id}
                  value={x.id}
                  label={x.name}
                  addOnBefore={() => vercelIcon}
                >
                  {x.name}
                </Listbox.Option>
              ))}
            </Listbox>
          </div>
          <div className="flex items-center flex-shrink">
            <Typography.Text type="secondary">
              <IconChevronRight />
            </Typography.Text>
          </div>
          <div className="flex-grow w-1/2">
            <Listbox
              value={supabaseProjectRef ?? UNDEFINED_SELECT_VALUE}
              onChange={onSupabaseProjectChange}
            >
              <Listbox.Option value={UNDEFINED_SELECT_VALUE} label="Choose a project" disabled>
                Choose a project
              </Listbox.Option>
              {sortedProjects?.map((x: Dictionary<any>) => (
                <Listbox.Option
                  key={x.id}
                  value={x.ref}
                  label={x.name}
                  addOnBefore={() => databaseIcon}
                >
                  {x.name}
                </Listbox.Option>
              ))}
            </Listbox>
          </div>
          {idx != 0 && (
            <div className="absolute top-[3px] right-[-50px]">
              <Button
                type="text"
                icon={<IconX size="small" strokeWidth={2} />}
                onClick={onRemove}
                disabled={_store.waitingIntegration}
              />
            </div>
          )}
        </div>
        {error && (
          <Typography.Text type="danger" small>
            {error}
          </Typography.Text>
        )}
        {_store.waitingIntegration && result && (
          <Typography.Text
            type={
              result.status == 'waiting'
                ? 'default'
                : result.status == 'fail'
                ? 'danger'
                : 'success'
            }
            small
          >
            {result?.message ?? 'Processing...'}
          </Typography.Text>
        )}
      </li>
    )
  }
)
